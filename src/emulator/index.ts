import { get } from "svelte/store";
import {
    setVerbose,
    isCgbMode,
    loadCartridgeRom,
    drawTileData,
    drawBackgroundMap,
    getBGTileMap,
    debugSetBreakpoint,
    debugSetPPUBreak,
    attachDebugger,
    detachDebugger,
    setMuteChannel,
    getOAMTiles,
    getGameFrameView,
    getCgbGameFrameView,
    getAudioBufferView,
} from "./wasmBridge";
import {
    addPostRunCallback,
    addRenderCallback,
    removePostRunCallback,
    removeRenderCallback,
    requestRunOneFrame,
    requestStep,
    FrameStats,
    FRAME_TIMES_LEN,
    RenderFrames,
} from "./loop";
import { pauseEmulator, resetEmulator, runUntilBreak } from "./lifecycle";
import { quickSave, quickLoad } from "./saveState";
import { playRom, loadSaveGame } from "./rom";
import { AudioSuspended } from "./audio";
import { Verbose, AudioBufferSize } from "stores/debugStores";

Verbose.subscribe(setVerbose);

export const Emulator = {
    Reset: resetEmulator,
    RunUntilBreak: runUntilBreak,
    Pause: pauseEmulator,
    GetGameFrame: getGameFrameView,
    GetCGBGameFrame: getCgbGameFrameView,
    IsCgbMode: () => isCgbMode(),
    LoadCartridgeRom: loadCartridgeRom,
    LoadSave: loadSaveGame,
    PlayRom: playRom,
    AddPostRunCallback: addPostRunCallback,
    RemovePostRunCallback: removePostRunCallback,
    AddRenderCallback: addRenderCallback,
    RemoveRenderCallback: removeRenderCallback,
    QuickSave: quickSave,
    QuickLoad: quickLoad,
};

export const Debug = {
    SetVerbose: setVerbose,
    RunFrame: requestRunOneFrame,
    Step: requestStep,
    SetBreakpoint: debugSetBreakpoint,
    SetMuteChannel: setMuteChannel,
    SetPPUBreak: debugSetPPUBreak,
    DrawBackgroundMap: drawBackgroundMap,
    DrawTileData: drawTileData,
    GetBGTileMap: getBGTileMap,
    GetOAMTiles: getOAMTiles,
    AttachDebugger: attachDebugger,
    DetachDebugger: detachDebugger,
    GetAudioBufferFromPtr: (ptr: number) => getAudioBufferView(ptr, get(AudioBufferSize)),
};

export { AudioSuspended, FrameStats, FRAME_TIMES_LEN, RenderFrames };
