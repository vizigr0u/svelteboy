import { get } from "svelte/store";
import {
    setJoypad,
    runOneFrame as backendRunOneFrame,
    runEmulator,
    getDebugInfo,
    debugStep,
    initEmulator,
    getGameFramePtr,
    loadCartridgeRom,
    drawTileData,
    drawBackgroundMap,
    getBGTileMap,
    debugSetBreakpoint,
    debugSetPPUBreak,
    attachDebugger,
    detachDebugger,
    setVerbose,
    getOAMTiles,
    loadSaveGame as emuLoadSave,
    getLastSave,
    getLastSaveFrame,
    memory as backendMemory,
    getAudioBuffersToReadCount,
    getAudioBuffersToReadSize,
    getAudioBufferToReadPointer,
    markAudioBuffersRead,
} from "../build/backend";
import { fetchLogs } from "./debug";
import { DebuggerAttached, GbDebugInfoStore, LastStopReason, Verbose } from "stores/debugStores";
import { AutoSave, EmulatorBusy, EmulatorInitialized, EmulatorPaused, GameFrames, KeyPressMap, SaveGames } from "stores/playStores";
import { DebugStopReason, isLocalRom, isRemoteRom, isStoredRom, type GbDebugInfo, type LocalRom, type RemoteRom, type RomReference, type SaveGameData, type StoredRom } from "./types";
import { EmulatorSpeed, useBoot } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { humanReadableSize } from "./utils";

let lastSaveFrame = 0;

let postRunCallbacks: (() => void)[] = [];
let runningAnimationFrameHandle = 0;

export const Emulator = {
    Reset: () => {
        Audio.Init();
        EmulatorInitialized.set(false);
        initEmulator(get(useBoot));
        EmulatorInitialized.set(true);
        postRun();
        if (get(DebuggerAttached))
            pauseEmulator();
    },
    RunUntilBreak: () => {
        lastRenderTime = -1;
        window.cancelAnimationFrame(runningAnimationFrameHandle);
        runningAnimationFrameHandle = window.requestAnimationFrame(run)
    },
    Pause: pauseEmulator,
    GetGameFrame: () => { return new Uint8ClampedArray(backendMemory.buffer, getGameFramePtr(), 144 * 160 * 4) },
    LoadCartridgeRom: loadCartridgeRom,
    LoadSave: (saveGame: SaveGameData) => { return loadSaveGame(saveGame); },
    PlayRom: playRom,
    AddPostRunCallback: (callback: () => void) => { postRunCallbacks.push(callback); }
}

export const Debug = {
    SetVerbose: setVerbose,
    RunFrame: () => {
        window.cancelAnimationFrame(runningAnimationFrameHandle);
        runningAnimationFrameHandle = window.requestAnimationFrame(runOneFrame)
    },
    Step: () => {
        window.cancelAnimationFrame(runningAnimationFrameHandle);
        runningAnimationFrameHandle = window.requestAnimationFrame(step)
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

let audioCtx: AudioContext;
let audioBuffer: AudioBuffer;
let audioContextStartOffset: number;

export const Audio = {
    Init: () => {
        audioCtx = new window.AudioContext();
        Emulator.AddPostRunCallback(postRunAudio);
    },
    Play: () => {
        let audioContextTimestamp = audioCtx.getOutputTimestamp();
        audioContextStartOffset = audioContextTimestamp.contextTime;
    }
}

let logDelay = 0;

function postRunAudio() {
    const numAvailableBuffers = getAudioBuffersToReadCount();
    if (getAudioBuffersToReadCount() > 0) {
        console.log("Grabbing " + numAvailableBuffers + " audio buffers");
        const size = getAudioBuffersToReadSize();
        const left = getAudioBuffer(getAudioBufferToReadPointer(0), size);
        if (logDelay-- == 0) {
            console.log(JSON.stringify(left));
            logDelay += 5000;
        }
        const right = getAudioBuffer(getAudioBufferToReadPointer(1), size);
        markAudioBuffersRead(numAvailableBuffers);
        audioBuffer = audioCtx.createBuffer(2, size, audioCtx.sampleRate);
        audioBuffer.copyToChannel(left, 0);
        audioBuffer.copyToChannel(right, 1);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
    }
}

function getAudioBuffer(ptr: number, size: number): Float32Array {
    return new Float32Array(backendMemory.buffer, ptr, size);
}

async function getRomBuffer(rom: RomReference): Promise<ArrayBuffer> {
    if (isStoredRom(rom)) {
        const storedRom: StoredRom = rom;
        return Buffer.from(storedRom.contentBase64, "base64");
    }
    if (isLocalRom(rom)) {
        const localRom: LocalRom = rom;
        return localRom.buffer;
    }
    if (isRemoteRom(rom)) {
        const remoteRom: RemoteRom = rom;
        const response = await fetch(remoteRom.uri);
        return await response.arrayBuffer();
    }
}

async function playRom(rom: RomReference): Promise<void> {
    const buffer = await getRomBuffer(rom);
    const loaded = await new Promise<boolean>((r) =>
        r(Emulator.LoadCartridgeRom(buffer))
    );
    if (!loaded) {
        console.log(`Error loading rom`);
        return;
    }
    Emulator.Pause();
    Emulator.Reset();
    loadedCartridge.set(rom);
    Emulator.RunUntilBreak();
}

let lastRenderTime: number = -1;

function run(time: number) {
    const dt = lastRenderTime <= 0 ? 15 : time - lastRenderTime;
    {
        preRun();
        const stopReason = runEmulator(dt * get(EmulatorSpeed));
        LastStopReason.set(stopReason);
        postRun();
        if (stopReason != DebugStopReason.TargetCyclesReached) {
            console.log('Stopped because ' + DebugStopReason[stopReason]);
            return;
        }
        lastRenderTime = time;
    }
    if (!get(EmulatorPaused))
        runningAnimationFrameHandle = window.requestAnimationFrame(run);
}

function runOneFrame() {
    preRun();
    LastStopReason.set(backendRunOneFrame());
    postRun();
    pauseEmulator();
}

function step() {
    preRun();
    debugStep();
    postRun();
    pauseEmulator();
}

function preRun(): void {
    setVerbose(get(Verbose));
    unPauseEmulator();
    EmulatorBusy.set(true);
    if (!get(EmulatorInitialized)) {
        initEmulator(get(useBoot));
        EmulatorInitialized.set(true);
    }
    const keys = getInputForEmu();
    setJoypad(keys);
}

let lastFrame = -1;

function postRun(): void {
    fetchLogs();
    if (get(DebuggerAttached)) {
        const info = getDebugInfo() as GbDebugInfo;
        GbDebugInfoStore.set(info);
        if (info.currentFrame != lastFrame) {
            GameFrames.update(frames => frames + 1);
            lastFrame = info.currentFrame;
        }
    }
    EmulatorBusy.set(false);
    const latestSaveFrame = getLastSaveFrame();
    if (latestSaveFrame > lastSaveFrame) {
        const currentGame: RomReference = get(loadedCartridge);
        const timeStamp = new Date().toISOString();
        AutoSave.set({
            buffer: getLastSave(),
            name: `autosave-${timeStamp}`,
            gameSha1: currentGame.sha1
        })
        lastSaveFrame = latestSaveFrame;
    }
    for (let i = 0; i < postRunCallbacks.length; i++) {
        postRunCallbacks[i]()
    }
}

function loadSaveGame(savegame: SaveGameData): boolean {
    console.log(`Loading savegame '${savegame.name}' of size ${humanReadableSize(savegame.buffer.byteLength)}...`)
    emuLoadSave(savegame.buffer);
    return false;
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
    window.cancelAnimationFrame(runningAnimationFrameHandle);
}

function unPauseEmulator(): void {
    EmulatorPaused.set(false);
    lastRenderTime = -1;
}
