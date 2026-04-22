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
    getAudioSampleRate,
    getAudioBuffersSize,
    getAudioBuffersToReadCount,
    getAudioBufferToReadPointer,
    markAudioBuffersRead,
    setMuteChannel,
    createSaveState,
    loadSaveState
} from "../build/backend";
import { PALETTE_PRESETS, SelectedPaletteIndex, type GBPalette } from "stores/optionsStore";
import { saveSlot, loadSlot } from "./saveStateDb";
import { fetchLogs } from "./debug";
import {
    AudioAnalyzerNode,
    AudioBufferPointers,
    AudioBufferSize,
    DebuggerAttached,
    GbDebugInfoStore,
    LastStopReason,
    MuteSoundChannel1,
    MuteSoundChannel2,
    MuteSoundChannel3,
    MuteSoundChannel4,
    Verbose
} from "stores/debugStores";
import { AutoSave, EmulatorBusy, EmulatorInitialized, EmulatorPaused, GameFrames, KeyPressMap, SaveGames } from "stores/playStores";
import { writable } from "svelte/store";

export const AudioSuspended = writable<boolean>(false);
import { DebugStopReason, isLocalRom, isRemoteRom, isStoredRom, type GbDebugInfo, type LocalRom, type RemoteRom, type RomReference, type SaveGameData } from "./types";
import { AudioMasterVolume, EmulatorSpeed, useBoot } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { humanReadableSize } from "./utils";

let lastSaveFrame = 0;

let postRunCallbacks: (() => void)[] = [];
let runningAnimationFrameHandle = 0;

function captureFrameThumbnail(frame: Uint8Array, palette: GBPalette): string {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 144;
    const ctx = canvas.getContext('2d')!;
    const imageData = new ImageData(160, 144);
    const data = imageData.data;
    for (let i = 0; i < 160 * 144; i++) {
        const c = palette[frame[i] & 3];
        data[i * 4 + 0] = c & 0xff;
        data[i * 4 + 1] = (c >> 8) & 0xff;
        data[i * 4 + 2] = (c >> 16) & 0xff;
        data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/webp', 0.7);
}

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
    GetGameFrame: () => new Uint8Array(backendMemory.buffer as ArrayBuffer, getGameFramePtr(), 160 * 144),
    LoadCartridgeRom: loadCartridgeRom,
    LoadSave: (saveGame: SaveGameData) => { return loadSaveGame(saveGame); },
    PlayRom: playRom,
    AddPostRunCallback: (callback: () => void) => { postRunCallbacks.push(callback); },
    RemovePostRunCallback: (callback: () => void) => {
        const i = postRunCallbacks.indexOf(callback);
        if (i !== -1) postRunCallbacks.splice(i, 1);
    },
    QuickSave: async (slot: number): Promise<void> => {
        const cartridge = get(loadedCartridge);
        if (!cartridge) return;
        const state = createSaveState();
        const palette = PALETTE_PRESETS[get(SelectedPaletteIndex)];
        const thumbnail = captureFrameThumbnail(Emulator.GetGameFrame(), palette);
        await saveSlot(cartridge.sha1, slot, { state, thumbnail, savedAt: Date.now() });
    },
    QuickLoad: async (slot: number): Promise<void> => {
        const cartridge = get(loadedCartridge);
        if (!cartridge) return;
        const entry = await loadSlot(cartridge.sha1, slot);
        if (!entry) return;
        loadSaveState(entry.state);
    }
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
    SetMuteChannel: setMuteChannel,
    SetPPUBreak: debugSetPPUBreak,
    DrawBackgroundMap: drawBackgroundMap,
    DrawTileData: drawTileData,
    GetBGTileMap: getBGTileMap,
    GetOAMTiles: getOAMTiles,
    AttachDebugger: attachDebugger,
    DetachDebugger: detachDebugger,
    GetAudioBufferFromPtr: (ptr: number) => getAudioBuffer(ptr, get(AudioBufferSize)),
}

//-------------------------------------
function generateSineWaveBuffers(frequency: number, sampleRate: number, durationSeconds: number, numBuffers: number) {
    const totalSamples = Math.round(durationSeconds * sampleRate);
    const samplesPerBuffer = Math.round(totalSamples / numBuffers);
    const sineWaveBuffers = [];

    let phase = 0;
    const angularFreq = 2 * Math.PI * frequency / sampleRate;

    for (let buf = 0; buf < numBuffers; buf++) {
        const audioBuffer = new Float32Array(samplesPerBuffer);
        for (let i = 0; i < samplesPerBuffer; i++) {
            audioBuffer[i] = Math.sin(phase);
            phase += angularFreq;
            if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
        }
        sineWaveBuffers.push(audioBuffer);
    }

    return sineWaveBuffers;
}

// Example usage:
const sampleRate = 44100;  // CD Quality
const durationSeconds = 10;
const numBuffers = 5;
const bufferSize = sampleRate * durationSeconds / numBuffers;

const AudioTestBuffers = generateSineWaveBuffers(440, 44100, 10, 5);

function getTestAudioBuffer(index: number): AudioBuffer {
    const audioBuffer = audioCtx.createBuffer(2, bufferSize, sampleRate);
    audioBuffer.copyToChannel(AudioTestBuffers[index], 0);
    audioBuffer.copyToChannel(AudioTestBuffers[index], 1);
    return audioBuffer;
}

//-------------------------------------

let wasInit: boolean = false;
let audioCtx: AudioContext;
let analyzerNode: AnalyserNode;
let masterVolumeNode: GainNode;
let destinationNode: AudioNode;
let audioContextStartOffset: number;

export const Audio = {
    Init: () => {
        if (wasInit)
            return;
        audioCtx = new window.AudioContext();
        masterVolumeNode = audioCtx.createGain();
        analyzerNode = audioCtx.createAnalyser();
        analyzerNode.connect(masterVolumeNode);
        AudioAnalyzerNode.set(analyzerNode);
        masterVolumeNode.connect(audioCtx.destination);
        masterVolumeNode.gain.value = get(AudioMasterVolume) * get(AudioMasterVolume);
        AudioMasterVolume.subscribe(gain => { masterVolumeNode.gain.value = gain * gain });
        MuteSoundChannel1.subscribe(setMute => { Debug.SetMuteChannel(1, setMute); });
        MuteSoundChannel2.subscribe(setMute => { Debug.SetMuteChannel(2, setMute); });
        MuteSoundChannel3.subscribe(setMute => { Debug.SetMuteChannel(3, setMute); });
        MuteSoundChannel4.subscribe(setMute => { Debug.SetMuteChannel(4, setMute); });

        destinationNode = analyzerNode;
        Emulator.AddPostRunCallback(postRunAudio);

        const updateSuspended = () => AudioSuspended.set(audioCtx.state === 'suspended');
        audioCtx.addEventListener('statechange', updateSuspended);
        updateSuspended();

        const resumeOnGesture = () => { audioCtx?.resume(); };
        document.addEventListener('click', resumeOnGesture);
        document.addEventListener('keydown', resumeOnGesture);

        wasInit = true;
    },
    Play: () => {
        let audioContextTimestamp = audioCtx.getOutputTimestamp();
        audioContextStartOffset = audioContextTimestamp.contextTime ?? 0;
    }
}

const TARGET_LOOKAHEAD_S = 0.30; // 80ms: survives occasional long frames without audible latency

function postRunAudio() {
    const bufferSize = getAudioBuffersSize();
    AudioBufferSize.set(bufferSize);
    const sampleRate = getAudioSampleRate();
    let numAvailableBuffers = getAudioBuffersToReadCount();

    // Context suspended: drain all WASM buffers to keep backend live, skip scheduling.
    if (audioCtx.state !== 'running') {
        if (numAvailableBuffers > 0)
            markAudioBuffersRead(numAvailableBuffers);
        return;
    }

    const bufferDuration = bufferSize / sampleRate;
    const lookahead = currentPlayTime - audioCtx.currentTime;
    const buffersToFillTarget = Math.ceil((TARGET_LOOKAHEAD_S - lookahead) / bufferDuration);
    const buffersToSchedule = Math.max(0, Math.min(numAvailableBuffers, buffersToFillTarget));

    const toDrain = numAvailableBuffers - buffersToSchedule;
    if (toDrain > 0)
        markAudioBuffersRead(toDrain);

    if (buffersToSchedule > 0) {
        const ptrs = [];
        for (let i = 0; i < buffersToSchedule; i++) {
            ptrs.push([getAudioBufferToReadPointer(0), getAudioBufferToReadPointer(1)]);
            const buffer = createAudioBufferFromData(bufferSize, sampleRate);
            queueBuffer(buffer);
            markAudioBuffersRead(1);
        }
        AudioBufferPointers.set(ptrs);
    }
}

function createAudioBufferFromData(bufferSize: number, sampleRate: number) {
    // console.log("Left Pointer: " + getAudioBufferToReadPointer(0) + ", Right: " + getAudioBufferToReadPointer(1));
    const audioBuffer = audioCtx.createBuffer(2, bufferSize, sampleRate);
    const left = getAudioBuffer(getAudioBufferToReadPointer(0), bufferSize);
    // if (logDelay-- <= 0) {
    //     console.log(JSON.stringify(left));
    //     if (logDelay < -3)
    //         logDelay += 1000;
    // }
    const right = getAudioBuffer(getAudioBufferToReadPointer(1), bufferSize);
    audioBuffer.copyToChannel(left, 0);
    audioBuffer.copyToChannel(right, 1);
    return audioBuffer;
}

let currentPlayTime = -1;

function queueBuffer(buffer: AudioBuffer) {
    if (currentPlayTime < audioCtx.currentTime) {
        currentPlayTime = audioCtx.currentTime;
    }

    playBuffer(buffer, currentPlayTime);

    // Update the currentPlayTime by adding buffer's duration
    currentPlayTime += buffer.duration;
}

function playBuffer(buffer: AudioBuffer, startTime: number): AudioBufferSourceNode {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(destinationNode);
    source.start(startTime);
    // console.log("Queue buffer to play at " + startTime);
    return source;
}


function getAudioBuffer(ptr: number, sampleCount: number): Float32Array<ArrayBuffer> {
    return new Float32Array(backendMemory.buffer as ArrayBuffer, ptr, sampleCount);
}

async function getRomBuffer(rom: RomReference): Promise<ArrayBuffer | undefined> {
    if (isStoredRom(rom)) {
        return rom.content;
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
    if (!buffer) return;
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
    if (!get(DebuggerAttached))
        Emulator.RunUntilBreak();
}

let lastRenderTime: number = -1;

function run(time: number) {
    const dt = lastRenderTime <= 0 ? 16.67 : Math.min(time - lastRenderTime, 50);
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

function postRun(): void {
    fetchLogs();
    GameFrames.update(frames => frames + 1);
    if (get(DebuggerAttached)) {
        const info = getDebugInfo() as GbDebugInfo;
        GbDebugInfoStore.set(info);
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
    audioCtx?.suspend();
    window.cancelAnimationFrame(runningAnimationFrameHandle);
}

function unPauseEmulator(): void {
    EmulatorPaused.set(false);
    audioCtx.resume();
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        window.cancelAnimationFrame(runningAnimationFrameHandle);
    });
}
