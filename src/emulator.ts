import { get } from "svelte/store";
import {
    setJoypad,
    runOneFrame as backendRunOneFrame,
    runEmulator,
    getDebugInfo,
    debugStep,
    initEmulator,
    getGameFramePtr,
    getCGBGameFramePtr,
    isCgbMode,
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
    loadSaveState,
    isAtFrameBoundary
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
import { DebugStopReason, type GbDebugInfo, type LibraryRom, type SaveGameData } from "./types";
import { AudioMasterVolume, AutoSaveUriRoms, EmulatorSpeed, PauseOnVisibilityLost, useBoot } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { getBytesBySha1, promoteUriToIdb, reconcileSha1OnFirstPlay } from "stores/libraryStore";
import { humanReadableSize } from "./utils";

let lastSaveFrame = 0;

let postRunCallbacks: (() => void)[] = [];
let renderCallbacks: (() => void)[] = [];
let runningAnimationFrameHandle = 0;

export const FRAME_TIMES_LEN = 240;
export const FrameStats = {
    frameTimesMs: new Float32Array(FRAME_TIMES_LEN),
    writeIndex: 0,
    totalWrites: 0,
    droppedCount: 0,
};
export const RenderFrames = writable<number>(0);

function encodeThumbnail(data: Uint8ClampedArray): string {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 144;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(160, 144);
    imageData.data.set(data);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/webp', 0.7);
}

function captureFrameThumbnail(frame: Uint8Array, palette: GBPalette): string {
    const data = new Uint8ClampedArray(160 * 144 * 4);
    for (let i = 0; i < 160 * 144; i++) {
        const c = palette[frame[i] & 3];
        data[i * 4 + 0] = c & 0xff;
        data[i * 4 + 1] = (c >> 8) & 0xff;
        data[i * 4 + 2] = (c >> 16) & 0xff;
        data[i * 4 + 3] = 255;
    }
    return encodeThumbnail(data);
}

function captureCgbFrameThumbnail(frame: Uint16Array): string {
    const data = new Uint8ClampedArray(160 * 144 * 4);
    for (let i = 0; i < 160 * 144; i++) {
        const rgb = frame[i];
        data[i * 4 + 0] = ((rgb & 31) * 255 / 31) | 0;
        data[i * 4 + 1] = (((rgb >> 5) & 31) * 255 / 31) | 0;
        data[i * 4 + 2] = (((rgb >> 10) & 31) * 255 / 31) | 0;
        data[i * 4 + 3] = 255;
    }
    return encodeThumbnail(data);
}

export const Emulator = {
    Reset: () => {
        Audio.Init();
        EmulatorInitialized.set(false);
        initEmulator(get(useBoot));
        EmulatorInitialized.set(true);
        lastTime = -1;
        accumulator = 0;
        postRun();
        if (get(DebuggerAttached))
            pauseEmulator();
    },
    RunUntilBreak: () => {
        lastTime = -1;
        accumulator = 0;
        unPauseEmulator();
        window.cancelAnimationFrame(runningAnimationFrameHandle);
        runningAnimationFrameHandle = window.requestAnimationFrame(run)
    },
    Pause: () => pauseEmulator(),
    GetGameFrame: () => new Uint8Array(backendMemory.buffer as ArrayBuffer, getGameFramePtr(), 160 * 144),
    GetCGBGameFrame: () => new Uint16Array(backendMemory.buffer as ArrayBuffer, getCGBGameFramePtr(), 160 * 144),
    IsCgbMode: () => isCgbMode(),
    LoadCartridgeRom: loadCartridgeRom,
    LoadSave: (saveGame: SaveGameData) => loadSaveGame(saveGame),
    PlayRom: playRom,
    AddPostRunCallback: (callback: () => void) => { postRunCallbacks.push(callback); },
    RemovePostRunCallback: (callback: () => void) => {
        const i = postRunCallbacks.indexOf(callback);
        if (i !== -1) postRunCallbacks.splice(i, 1);
    },
    AddRenderCallback: (callback: () => void) => { renderCallbacks.push(callback); },
    RemoveRenderCallback: (callback: () => void) => {
        const i = renderCallbacks.indexOf(callback);
        if (i !== -1) renderCallbacks.splice(i, 1);
    },
    QuickSave: async (slot: number): Promise<void> => {
        const cartridge = get(loadedCartridge);
        if (!cartridge) return;
        if (get(DebuggerAttached)) return;
        const wasRunning = !get(EmulatorPaused);
        pauseEmulator();
        if (!isAtFrameBoundary()) backendRunOneFrame();
        const state = createSaveState();
        if (state.byteLength === 0) {
            if (wasRunning) Emulator.RunUntilBreak();
            return;
        }
        const thumbnail = isCgbMode()
            ? captureCgbFrameThumbnail(Emulator.GetCGBGameFrame())
            : captureFrameThumbnail(Emulator.GetGameFrame(), PALETTE_PRESETS[get(SelectedPaletteIndex)]);
        await saveSlot(cartridge.sha1, slot, { state, thumbnail, savedAt: Date.now() });
        if (wasRunning) Emulator.RunUntilBreak();
    },
    QuickLoad: async (slot: number): Promise<void> => {
        const cartridge = get(loadedCartridge);
        if (!cartridge) return;
        const entry = await loadSlot(cartridge.sha1, slot);
        if (!entry) return;
        const wasRunning = !get(EmulatorPaused);
        pauseEmulator();
        stopQueuedAudio();
        loadSaveState(entry.state);
        if (wasRunning && !get(DebuggerAttached)) Emulator.RunUntilBreak();
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

const TARGET_LOOKAHEAD_S = 0.30; // num seconds to survive occasional long frames without audible latency

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
const activeSourceNodes: AudioBufferSourceNode[] = [];

const FADE_OUT_S = 0.02;
let audioFadedOut = false;
let pendingSuspendTimeout: ReturnType<typeof setTimeout> | null = null;

function stopQueuedAudio() {
    if (!audioCtx) return;
    audioFadedOut = true;
    const now = audioCtx.currentTime;
    masterVolumeNode.gain.cancelScheduledValues(now);
    masterVolumeNode.gain.setValueAtTime(masterVolumeNode.gain.value, now);
    masterVolumeNode.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);

    const nodesToStop = activeSourceNodes.slice();
    activeSourceNodes.length = 0;
    currentPlayTime = -1;
    const pending = getAudioBuffersToReadCount();
    if (pending > 0) markAudioBuffersRead(pending);

    setTimeout(() => {
        for (const node of nodesToStop) {
            try { node.stop(); } catch (_) {}
        }
    }, FADE_OUT_S * 1000 + 5);
}

const PREROLL_S = 0.05;

function queueBuffer(buffer: AudioBuffer) {
    if (currentPlayTime < audioCtx.currentTime) {
        currentPlayTime = audioCtx.currentTime + PREROLL_S;
    }

    const source = playBuffer(buffer, currentPlayTime);
    activeSourceNodes.push(source);
    source.onended = () => {
        const i = activeSourceNodes.indexOf(source);
        if (i !== -1) activeSourceNodes.splice(i, 1);
    };

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

async function getRomBuffer(rom: LibraryRom): Promise<ArrayBuffer | undefined> {
    const src = rom.source;
    if (src.kind === 'idb') {
        return getBytesBySha1(rom.sha1);
    }
    if (src.kind === 'uri') {
        const response = await fetch(src.uri);
        if (!response.ok) return undefined;
        return await response.arrayBuffer();
    }
    if (src.kind === 'cloud') {
        throw new Error('Cloud ROM source not implemented');
    }
    return undefined;
}

async function playRom(rom: LibraryRom): Promise<void> {
    const buffer = await getRomBuffer(rom);
    if (!buffer) return;
    if (!Emulator.LoadCartridgeRom(buffer)) {
        console.log(`Error loading rom`);
        return;
    }
    let activeRom: LibraryRom = rom;
    if (rom.sha1.startsWith('uri:')) {
        const reconciled = await reconcileSha1OnFirstPlay(rom.sha1, buffer, get(AutoSaveUriRoms));
        if (reconciled) activeRom = reconciled;
    } else if (rom.source.kind === 'uri' && get(AutoSaveUriRoms)) {
        promoteUriToIdb(rom.sha1, buffer).catch(err => console.error('promoteUriToIdb failed:', err));
    }
    Emulator.Pause();
    Emulator.Reset();
    loadedCartridge.set(activeRom);
    if (!get(DebuggerAttached))
        Emulator.RunUntilBreak();
}

const GB_FRAME_MS = 70224 / 4194.304;
const MAX_CATCHUP = 4;

let lastTime: number = -1;
let accumulator: number = 0;

const DROPPED_FRAME_MS = 20;

function run(time: number) {
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
        const currentGame = get(loadedCartridge) as { sha1: string };
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

function loadSaveGame(savegame: SaveGameData): void {
    console.log(`Loading savegame '${savegame.name}' of size ${humanReadableSize(savegame.buffer.byteLength)}...`)
    emuLoadSave(savegame.buffer);
}

function getInputForEmu(): number {
    let res = 0;
    for (let k of get(KeyPressMap)) {
        res |= Number(k)
    }
    return res;
}

const RESUME_FADE_S = 0.02;

function pauseEmulator(): void {
    EmulatorPaused.set(true);
    stopQueuedAudio();
    if (pendingSuspendTimeout != null) clearTimeout(pendingSuspendTimeout);
    pendingSuspendTimeout = setTimeout(() => {
        pendingSuspendTimeout = null;
        audioCtx?.suspend();
    }, (FADE_OUT_S * 1000) + 10);
    window.cancelAnimationFrame(runningAnimationFrameHandle);
    lastTime = -1;
    accumulator = 0;
}

function unPauseEmulator(): void {
    EmulatorPaused.set(false);
    if (!audioCtx) return;
    if (pendingSuspendTimeout != null) {
        clearTimeout(pendingSuspendTimeout);
        pendingSuspendTimeout = null;
    }
    if (!audioFadedOut && audioCtx.state === 'running') return;
    audioFadedOut = false;
    audioCtx.resume().then(() => {
        if (!audioCtx) return;
        const target = get(AudioMasterVolume) ** 2;
        const now = audioCtx.currentTime;
        const cur = masterVolumeNode.gain.value;
        masterVolumeNode.gain.cancelScheduledValues(now);
        masterVolumeNode.gain.setValueAtTime(cur, now);
        masterVolumeNode.gain.linearRampToValueAtTime(target, now + RESUME_FADE_S);
    });
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        window.cancelAnimationFrame(runningAnimationFrameHandle);
    });
}

let pausedByVisibility = false;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (get(PauseOnVisibilityLost) && !get(EmulatorPaused)) {
            pausedByVisibility = true;
            Emulator.Pause();
        }
    } else if (!get(DebuggerAttached) && pausedByVisibility) {
        pausedByVisibility = false;
        Emulator.RunUntilBreak();
    }
});

