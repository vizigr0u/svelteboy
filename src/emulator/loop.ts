import { get, writable } from "svelte/store";
import {
    runOneFrame as backendRunOneFrame,
    runEmulator,
    getDebugInfo,
    debugStep,
    initEmulator,
    getLastSave,
    getLastSaveFrame,
} from "./wasmBridge";
import { fetchLogs } from "../debug";
import { appendLog } from "stores/debugStores";
import { DebuggerAttached, GbDebugInfoStore, LastStopReason } from "stores/debugStores";
import { AutoSave, EmulatorBusy, EmulatorInitialized, EmulatorPaused, FastForwardActive, GameFrames, KeyPressMap } from "stores/playStores";
import { EmulatorSpeed, HoldSpaceForSpeed, useBoot } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { DebugStopReason, type GbDebugInfo } from "../types";
import { pauseEmulator } from "./lifecycle";

const FRAME_LOG_BATCH = 1000;

export const FRAME_TIMES_LEN = 240;
export const FrameStats = {
    frameTimesMs: new Float32Array(FRAME_TIMES_LEN),
    writeIndex: 0,
    totalWrites: 0,
    droppedCount: 0,
};
export const RenderFrames = writable<number>(0);

const GB_FRAME_MS = 70224 / 4194.304;
const MIN_CATCHUP = 4;
const HARD_CAP_FRAMES = 256;
const TICK_BUDGET_MS = 12;
const MAX_SPEED = 100;
const DROPPED_FRAME_MS = 20;
// Worker round-trip is ~0.1 ms; doing one per emulator frame caps fast-forward
// throughput. Batch up to this many frames per RunEmulator call so a 50× run
// pays a handful of round-trips per rAF tick instead of 50.
const MAX_FRAMES_PER_BATCH = 16;

let lastTime = -1;
let accumulator = 0;
let lastSaveFrame = 0;
let runningAnimationFrameHandle = 0;

const postRunCallbacks: (() => void)[] = [];
const renderCallbacks: (() => void)[] = [];

export function addPostRunCallback(cb: () => void): void { postRunCallbacks.push(cb); }
export function removePostRunCallback(cb: () => void): void {
    const i = postRunCallbacks.indexOf(cb);
    if (i !== -1) postRunCallbacks.splice(i, 1);
}
export function addRenderCallback(cb: () => void): void { renderCallbacks.push(cb); }
export function removeRenderCallback(cb: () => void): void {
    const i = renderCallbacks.indexOf(cb);
    if (i !== -1) renderCallbacks.splice(i, 1);
}

export function resetTiming(): void { lastTime = -1; accumulator = 0; }
export function cancelLoop(): void { window.cancelAnimationFrame(runningAnimationFrameHandle); }

export function requestRunLoop(): void {
    cancelLoop();
    runningAnimationFrameHandle = window.requestAnimationFrame(run);
}

export function requestRunOneFrame(): void {
    cancelLoop();
    runningAnimationFrameHandle = window.requestAnimationFrame(runOneFrameTick);
}

export function requestStep(): void {
    cancelLoop();
    runningAnimationFrameHandle = window.requestAnimationFrame(stepTick);
}

async function run(time: number): Promise<void> {
    if (lastTime < 0) lastTime = time;
    const wallDt = Math.min(time - lastTime, 100);
    lastTime = time;

    FrameStats.frameTimesMs[FrameStats.writeIndex] = wallDt;
    FrameStats.writeIndex = (FrameStats.writeIndex + 1) % FRAME_TIMES_LEN;
    FrameStats.totalWrites++;
    if (wallDt > DROPPED_FRAME_MS) FrameStats.droppedCount++;

    const rawSpeed = get(EmulatorSpeed);
    const userSpeed = Number.isFinite(rawSpeed) && rawSpeed > 0
        ? Math.min(rawSpeed, MAX_SPEED)
        : 1;
    const speed = get(HoldSpaceForSpeed)
        ? (get(FastForwardActive) ? userSpeed : 1)
        : userSpeed;
    accumulator += wallDt * speed;

    const tickStart = performance.now();
    let framesThisTick = 0;
    while (accumulator >= GB_FRAME_MS && framesThisTick < HARD_CAP_FRAMES) {
        // Always grant MIN_CATCHUP frames (covers occasional rAF stalls at 1x);
        // beyond that, only continue while wall-time budget remains.
        if (framesThisTick >= MIN_CATCHUP && performance.now() - tickStart >= TICK_BUDGET_MS)
            break;
        const framesPossible = Math.min(
            Math.floor(accumulator / GB_FRAME_MS),
            HARD_CAP_FRAMES - framesThisTick,
            MAX_FRAMES_PER_BATCH,
        );
        const batchSize = Math.max(1, framesPossible);
        await preRun();
        const result = await runEmulator(GB_FRAME_MS * batchSize, {
            joypad: getInputForEmu(),
            maxLogLines: FRAME_LOG_BATCH * batchSize,
        });
        if (result.logs.length) appendLog(result.logs);
        LastStopReason.set(result.stopReason);
        await postRun(result.lastSaveFrame, batchSize);
        if (result.stopReason !== DebugStopReason.EndOfFrame && result.stopReason !== DebugStopReason.TargetCyclesReached) {
            console.log('Stopped because ' + DebugStopReason[result.stopReason]);
            return;
        }
        accumulator -= GB_FRAME_MS * batchSize;
        framesThisTick += batchSize;
    }

    // Backlog grew faster than backend can run — drop it to prevent runaway accumulation.
    if (accumulator > GB_FRAME_MS * HARD_CAP_FRAMES) accumulator = 0;

    if (framesThisTick > 0) {
        for (let i = 0; i < renderCallbacks.length; i++) renderCallbacks[i]();
    }
    RenderFrames.update(n => n + 1);

    if (!get(EmulatorPaused))
        runningAnimationFrameHandle = window.requestAnimationFrame(run);
}

async function runOneFrameTick(): Promise<void> {
    await preRun();
    const result = await backendRunOneFrame({ joypad: getInputForEmu(), maxLogLines: FRAME_LOG_BATCH });
    if (result.logs.length) appendLog(result.logs);
    LastStopReason.set(result.stopReason);
    await postRun(result.lastSaveFrame);
    pauseEmulator();
}

async function stepTick(): Promise<void> {
    await preRun();
    await debugStep();
    await postRun();
    pauseEmulator();
}

async function preRun(): Promise<void> {
    EmulatorBusy.set(true);
    if (!get(EmulatorInitialized)) {
        await initEmulator(get(useBoot));
        EmulatorInitialized.set(true);
    }
}

export async function postRun(latestSaveFrame?: number, framesAdvanced: number = 1): Promise<void> {
    // Run-loop / runOneFrameTick already pulled logs as part of the bundled
    // command. Non-run callers (resetEmulator, stepTick) still drain manually.
    if (latestSaveFrame === undefined) {
        await fetchLogs();
    }
    GameFrames.update(frames => frames + framesAdvanced);
    if (get(DebuggerAttached)) {
        const info = (await getDebugInfo()) as GbDebugInfo;
        GbDebugInfoStore.set(info);
    }
    EmulatorBusy.set(false);
    const latest = latestSaveFrame ?? await getLastSaveFrame();
    if (latest > lastSaveFrame) {
        const currentGame = get(loadedCartridge) as { sha1: string };
        const timeStamp = new Date().toISOString();
        AutoSave.set({
            buffer: await getLastSave(),
            name: `autosave-${timeStamp}`,
            gameSha1: currentGame.sha1
        });
        lastSaveFrame = latest;
    }
    for (let i = 0; i < postRunCallbacks.length; i++) {
        postRunCallbacks[i]();
    }
}

function getInputForEmu(): number {
    let res = 0;
    for (const k of get(KeyPressMap)) {
        res |= Number(k);
    }
    return res;
}
