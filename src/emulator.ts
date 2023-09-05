import { get } from "svelte/store";
import {
    setJoypad,
    runOneFrame,
    getDebugInfo,
    debugStep,
    initEmulator,
    getGameFrame,
    loadCartridgeRom,
    drawTileData,
    drawBackgroundMap,
    getBGTileMap,
    debugSetBreakpoint,
    debugSetPPUBreak,
    attachDebugger,
    detachDebugger,
    setVerbose,
    getOAMTiles
} from "../build/release/backend";
import { fetchLogs } from "./debug";
import { DebuggerAttached, GbDebugInfoStore, LastStopReason } from "./stores/debugStores";
import { EmulatorBusy, EmulatorInitialized, EmulatorPaused, GameFrames, KeyPressMap } from "./stores/playStores";
import { DebugStopReason, type GbDebugInfo } from "./types";
import { frameDelay, useBoot } from "./stores/optionsStore";

export const Emulator = {
    Reset: () => {
        EmulatorInitialized.set(false);
        initEmulator(get(useBoot));
        EmulatorInitialized.set(true);
        postRun();
        GameFrames.set(0)
        if (get(DebuggerAttached))
            pauseEmulator();
    },
    RunUntilBreak: async () => {
        do {
            await runFrame();
            if (!get(EmulatorPaused) && get(LastStopReason) == DebugStopReason.EndOfFrame)
                await new Promise((r) => setTimeout(r, get(frameDelay)));
        } while (!get(EmulatorPaused) && get(LastStopReason) == DebugStopReason.EndOfFrame
        );
        pauseEmulator();
    },
    Pause: pauseEmulator,
    GetGameFrame: getGameFrame,
    LoadCartridgeRom: loadCartridgeRom
}

export const Debug = {
    SetVerbose: setVerbose,
    RunFrame: async () => {
        await runFrame()
        pauseEmulator();
    },
    Step: async () => {
        preRun();
        await new Promise<void>((r) => { debugStep(); r(); });
        postRun();
        pauseEmulator();
    },
    SetBreakpoint: debugSetBreakpoint,
    SetPPUBreak: debugSetPPUBreak,
    DrawBackgroundMap: drawBackgroundMap,
    DrawTileData: drawTileData,
    GetBGTileMap: getBGTileMap,
    GetOAMTiles: getOAMTiles,
    AttachDebugger: attachDebugger,
    DetachDebugger: detachDebugger,
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

function getInputForEmu(): number {
    let res = 0;
    for (let k of get(KeyPressMap)) {
        res |= Number(k)
    }
    return res;
}

function pauseEmulator(): void {
    EmulatorPaused.set(true);
}

function unPauseEmulator(): void {
    EmulatorPaused.set(false);
}
