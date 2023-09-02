import { get } from "svelte/store";
import { setJoypad, runOneFrame, getDebugInfo, debugStep, initEmulator } from "../build/release";
import { fetchLogs } from "./debug";
import { getInputForEmu } from "./inputs";
import { DebuggerAttached, GbDebugInfoStore, LastStopReason } from "./stores/debugStores";
import { EmulatorBusy, EmulatorInitialized, EmulatorPaused, GameFrames } from "./stores/playStores";
import { DebugStopReason, type GbDebugInfo } from "./types";
import { frameDelay, useBoot } from "./stores/optionsStore";

export function resetEmulator() {
    EmulatorInitialized.set(false);
    initEmulator(get(useBoot));
    EmulatorInitialized.set(true);
    postRun();
    GameFrames.set(0)
    if (get(DebuggerAttached))
        pauseEmulator();
}

export async function runEmulatorFrame() {
    await runFrame()
    pauseEmulator();
}

export async function runUntilBreak() {
    do {
        await runFrame();
        if (!get(EmulatorPaused) && get(LastStopReason) == DebugStopReason.EndOfFrame)
            await new Promise((r) => setTimeout(r, get(frameDelay)));
    } while (!get(EmulatorPaused) && get(LastStopReason) == DebugStopReason.EndOfFrame
    );
    pauseEmulator();
}

export async function runEmulatorStep() {
    preRun();
    await new Promise<void>((r) => { debugStep(); r(); });
    postRun();
    pauseEmulator();
}

async function runFrame() {
    preRun();
    await new Promise<void>((r) => { LastStopReason.set(runOneFrame()); r(); });
    GameFrames.update(f => f + 1);
    postRun();
}

function preRun(): void {
    unPauseEmulator();
    EmulatorBusy.set(true);
    if (!get(EmulatorInitialized)) {
        initEmulator(get(useBoot));
        EmulatorInitialized.set(true);
    }
    const keys = getInputForEmu();
    setJoypad(keys);
}

function postRun(): void {
    fetchLogs();
    if (get(DebuggerAttached))
        GbDebugInfoStore.set(getDebugInfo() as GbDebugInfo);
    EmulatorBusy.set(false);
}

export function pauseEmulator(): void {
    EmulatorPaused.set(true);
}

function unPauseEmulator(): void {
    EmulatorPaused.set(false);
}
