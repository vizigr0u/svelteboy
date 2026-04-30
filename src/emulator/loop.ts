import { get, writable } from "svelte/store";
import {
    setJoypad,
    runOneFrame as backendRunOneFrame,
    runEmulator,
    getDebugInfo,
    debugStep,
    initEmulator,
    getLastSave,
    getLastSaveFrame,
} from "./wasmBridge";
import { fetchLogs } from "../debug";
import { DebuggerAttached, GbDebugInfoStore, LastStopReason } from "stores/debugStores";
import { AutoSave, EmulatorBusy, EmulatorInitialized, EmulatorPaused, GameFrames, KeyPressMap } from "stores/playStores";
import { EmulatorSpeed, useBoot } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { DebugStopReason, type GbDebugInfo } from "../types";
import { pauseEmulator } from "./lifecycle";

export const FRAME_TIMES_LEN = 240;
export const FrameStats = {
    frameTimesMs: new Float32Array(FRAME_TIMES_LEN),
    writeIndex: 0,
    totalWrites: 0,
    droppedCount: 0,
};
export const RenderFrames = writable<number>(0);

const GB_FRAME_MS = 70224 / 4194.304;
const MAX_CATCHUP = 4;
const DROPPED_FRAME_MS = 20;

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

function run(time: number): void {
    if (lastTime < 0) lastTime = time;
    const wallDt = Math.min(time - lastTime, 100);
    lastTime = time;

    FrameStats.frameTimesMs[FrameStats.writeIndex] = wallDt;
    FrameStats.writeIndex = (FrameStats.writeIndex + 1) % FRAME_TIMES_LEN;
    FrameStats.totalWrites++;
    if (wallDt > DROPPED_FRAME_MS) FrameStats.droppedCount++;

    accumulator += wallDt * get(EmulatorSpeed);

    let framesThisTick = 0;
    while (accumulator >= GB_FRAME_MS && framesThisTick < MAX_CATCHUP) {
        preRun();
        const stopReason = runEmulator(GB_FRAME_MS);
        LastStopReason.set(stopReason);
        postRun();
        if (stopReason !== DebugStopReason.EndOfFrame && stopReason !== DebugStopReason.TargetCyclesReached) {
            console.log('Stopped because ' + DebugStopReason[stopReason]);
            return;
        }
        accumulator -= GB_FRAME_MS;
        framesThisTick++;
    }

    if (accumulator > GB_FRAME_MS * MAX_CATCHUP) accumulator = 0;

    if (framesThisTick > 0) {
        for (let i = 0; i < renderCallbacks.length; i++) renderCallbacks[i]();
    }
    RenderFrames.update(n => n + 1);

    if (!get(EmulatorPaused))
        runningAnimationFrameHandle = window.requestAnimationFrame(run);
}

function runOneFrameTick(): void {
    preRun();
    LastStopReason.set(backendRunOneFrame());
    postRun();
    pauseEmulator();
}

function stepTick(): void {
    preRun();
    debugStep();
    postRun();
    pauseEmulator();
}

function preRun(): void {
    EmulatorBusy.set(true);
    if (!get(EmulatorInitialized)) {
        initEmulator(get(useBoot));
        EmulatorInitialized.set(true);
    }
    const keys = getInputForEmu();
    setJoypad(keys);
}

export function postRun(): void {
    fetchLogs();
    GameFrames.update(frames => frames + 1);
    if (get(DebuggerAttached)) {
        const info = getDebugInfo() as GbDebugInfo;
        GbDebugInfoStore.set(info);
    }
    EmulatorBusy.set(false);
    const latestSaveFrame = getLastSaveFrame();
    if (latestSaveFrame > lastSaveFrame) {
        const currentGame = get(loadedCartridge) as { sha1: string };
        const timeStamp = new Date().toISOString();
        AutoSave.set({
            buffer: getLastSave(),
            name: `autosave-${timeStamp}`,
            gameSha1: currentGame.sha1
        });
        lastSaveFrame = latestSaveFrame;
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
