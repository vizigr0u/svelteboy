// Bridge between Svelte/UI code and the AssemblyScript backend.
//
// Owns the shared WebAssembly.Memory and the emulator Worker that hosts the
// (single) WASM instance. Main thread NEVER instantiates the backend — AS
// class-static fields compile to per-instance WASM globals, so two instances
// would not share state and a "main-thread mirror" instance would be useless.
//
// All backend calls are async via `emulatorProxy`. View helpers below build
// zero-copy typed-array views over the shared memory once the worker reports
// the relevant base addresses (frame buffers via Init, audio ring via
// Bootstrap/Call, etc.).

import { writable } from 'svelte/store';
import { createSharedMemory } from './backendLoader';
import { createProxy, type EmulatorProxy, type ProxyTransport, type RunOptions } from './worker/proxy';
import type { BackendStaticInfo, WorkerCommand, WorkerOutbound } from './worker/protocol';
import { SabRing } from '../audio/sabRingBuffer';

// Reactive mirror of `isCgbMode()` — refreshed on each Init so sync callers
// (per-frame render path) don't pay a round-trip per query.
export const isCgbModeStore = writable<boolean>(false);

// Audio SAB ring shared across {worker (writer), worklet (reader), main (reset)}.
// 16384 stereo frames @ 44.1 kHz ≈ 371 ms — enough to absorb stalls.
export const AUDIO_SAB_CAPACITY = 16384;
export const audioSab: SharedArrayBuffer = SabRing.allocate(AUDIO_SAB_CAPACITY);

const sharedMemory = createSharedMemory();

function makeTransport(worker: Worker): ProxyTransport {
    return {
        postMessage: (msg: WorkerCommand) => worker.postMessage(msg),
        addMessageListener: (cb) => {
            const listener = (e: MessageEvent<WorkerOutbound>) => cb(e.data);
            worker.addEventListener('message', listener as EventListener);
            return () => worker.removeEventListener('message', listener as EventListener);
        },
    };
}

const emulatorWorker = new Worker(new URL('./worker/worker.ts', import.meta.url), {
    type: 'module',
    name: 'svelteboy-emulator',
});

export const emulatorProxy: EmulatorProxy = createProxy(makeTransport(emulatorWorker));
export const memory: WebAssembly.Memory = sharedMemory;
export const backendMemory: WebAssembly.Memory = sharedMemory;
export const backendStaticInfo: BackendStaticInfo = await emulatorProxy.bootstrap({
    memory: sharedMemory,
    audioSab,
    audioCapacity: AUDIO_SAB_CAPACITY,
});

// Frame pointers — set on every Init, cached so view helpers stay sync.
let cachedGameFramePtr = 0;
let cachedCgbFramePtr = 0;
export function updateFramePtrs(gameFramePtr: number, cgbFramePtr: number): void {
    cachedGameFramePtr = gameFramePtr;
    cachedCgbFramePtr = cgbFramePtr;
}
export function getGameFramePtr(): number { return cachedGameFramePtr; }
export function getCGBGameFramePtr(): number { return cachedCgbFramePtr; }

export function getGameFrameView(): Uint8Array {
    return new Uint8Array(sharedMemory.buffer as ArrayBuffer, cachedGameFramePtr, 160 * 144);
}

export function getCgbGameFrameView(): Uint16Array {
    return new Uint16Array(sharedMemory.buffer as ArrayBuffer, cachedCgbFramePtr, 160 * 144);
}

export function getAudioBufferView(ptr: number, sampleCount: number): Float32Array<ArrayBuffer> {
    return new Float32Array(sharedMemory.buffer as ArrayBuffer, ptr, sampleCount);
}

// --- Async backend API ---
// All of these are 1-line wrappers around emulatorProxy.call. They preserve
// the symbol names consumers were already importing, so call sites just need
// `await`/`async` adjustments.

const c = <R>(fn: string, args: unknown[] = []) => emulatorProxy.call<R>(fn, args);

export async function initEmulator(useBootRom: boolean): Promise<void> {
    const addr = await emulatorProxy.init(useBootRom);
    updateFramePtrs(addr.gameFramePtr, addr.cgbFramePtr);
    isCgbModeStore.set(await emulatorProxy.call<boolean>('isCgbMode'));
}
export const runEmulator = (timeMs: number, opts: RunOptions) => emulatorProxy.runEmulator(timeMs, opts);
export const runOneFrame = (opts: RunOptions) => emulatorProxy.runOneFrame(opts);
export const runFrames = (n: number) => c<void>('runFrames', [n]);

export const setJoypad = (bits: number) => c<void>('setJoypad', [bits]);
export const setVerbose = (level: number) => c<void>('setVerbose', [level]);
export const serialEnableLog = (enabled: boolean) => c<void>('serialEnableLog', [enabled]);
export const dumpLogToConsole = (enabled?: boolean, disableBuffer?: boolean) =>
    c<void>('dumpLogToConsole', [enabled, disableBuffer]);
export const spliceLogs = (maxLines: number) => c<string[]>('spliceLogs', [maxLines]);

export const loadBootRom = (rom: ArrayBuffer) => c<boolean>('loadBootRom', [rom]);
export const loadCartridgeRom = (rom: ArrayBuffer) => c<boolean>('loadCartridgeRom', [rom]);
export const extractMetadata = (rom: ArrayBuffer) => c<unknown>('extractMetadata', [rom]);
export const hexDump = (from: number, count: number) => c<Uint8Array>('hexDump', [from, count]);

export const isCgbMode = () => c<boolean>('isCgbMode');
export const isDoubleSpeed = () => c<boolean>('isDoubleSpeed');

export const loadSaveGame = (buffer: Uint8Array) => c<void>('loadSaveGame', [buffer]);
export const getLastSave = () => c<Uint8Array>('getLastSave');
export const getLastSaveFrame = () => c<number>('getLastSaveFrame');
export const createSaveState = () => c<Uint8Array>('createSaveState');
export const loadSaveState = (data: Uint8Array) => c<boolean>('loadSaveState', [data]);
export const isAtFrameBoundary = () => c<boolean>('isAtFrameBoundary');

export const getAudioSampleRate = () => backendStaticInfo.audioSampleRate;
export const getAudioBuffersSize = () => backendStaticInfo.audioBufferSize;
export const getAudioBuffersToReadCount = () => c<number>('getAudioBuffersToReadCount');
export const getAudioBufferToReadPointer = (channel: number) =>
    c<number>('getAudioBufferToReadPointer', [channel]);
export const markAudioBuffersRead = (count: number) => c<void>('markAudioBuffersRead', [count]);
export const setMuteChannel = (channel: number, muted: boolean) =>
    c<void>('setMuteChannel', [channel, muted]);
export const setMasterAudioToggle = (on: boolean) => c<void>('setMasterAudioToggle', [on]);

export const attachDebugger = () => c<void>('attachDebugger');
export const detachDebugger = () => c<void>('detachDebugger');
export const debugStep = () => c<void>('debugStep');
export const debugSetBreakpoint = (address: number, enabled?: boolean) =>
    c<void>('debugSetBreakpoint', [address, enabled]);
export const debugSetPPUBreak = (mode: number, enabled?: boolean) =>
    c<void>('debugSetPPUBreak', [mode, enabled]);
export const debugHasBreakpoint = (address: number) => c<boolean>('debugHasBreakpoint', [address]);
export const getActiveBreakpoints = () => c<number[]>('getActiveBreakpoints');
export const getDebugInfo = () => c<unknown>('getDebugInfo');

export const drawTileData = (buf: Uint8ClampedArray, w: number) =>
    c<Uint8ClampedArray>('drawTileData', [buf, w]);
export const drawBackgroundMap = (buf: Uint8ClampedArray) =>
    c<Uint8ClampedArray>('drawBackgroundMap', [buf]);
export const getBGTileMap = (buf: Uint8Array) => c<Uint8Array>('getBGTileMap', [buf]);
export const getOAMTiles = (buf: Uint32Array) => c<Uint32Array>('getOAMTiles', [buf]);
export const getBootLines = (from: number, to: number) =>
    c<unknown[]>('getBootLines', [from, to]);
export const getCartLines = (from: number, to: number) =>
    c<unknown[]>('getCartLines', [from, to]);
export const disassembleBoot = (off: number, len: number) =>
    c<string>('disassembleBoot', [off, len]);
export const disassembleCartridge = (off: number, len: number) =>
    c<string>('disassembleCartridge', [off, len]);
