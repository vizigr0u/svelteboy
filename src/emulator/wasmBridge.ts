// Bridge between Svelte/UI code and the AssemblyScript backend.
// Owns the shared WebAssembly.Memory, spawns the emulator worker, then
// instantiates the main-thread backend on the SAME memory.
//
// Order matters. The worker has to bootstrap FIRST so its module-init runs
// first; the main-thread `loadBackend` then runs second and its static field
// initializers (Cartridge.Data = new Metadata(), TLSF heap header, etc.)
// overwrite the worker's, leaving the main-thread instance as the canonical
// owner of static state. Subsequent main calls (loadCartridgeRom, …) update
// shared memory in place, and the worker's runEmulator reads the same state.
//
// B5/B6 will move every remaining stateful main-thread call into the worker
// so we can drop the second instantiation entirely.

import { loadBackend, createSharedMemory, type BackendInstance } from './backendLoader';
import { createProxy, type EmulatorProxy, type ProxyTransport } from './worker/proxy';
import type { WorkerCommand, WorkerOutbound } from './worker/protocol';

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
await emulatorProxy.bootstrap(sharedMemory);

const backend: BackendInstance = await loadBackend(sharedMemory);

export const memory: WebAssembly.Memory = sharedMemory;
export const backendMemory: WebAssembly.Memory = sharedMemory;

export const initEmulator = backend.initEmulator;
export const runFrames = backend.runFrames;
export const runOneFrame = backend.runOneFrame;
export const runEmulator = backend.runEmulator;
export const getGameFrame = backend.getGameFrame;
export const getGameFramePtr = backend.getGameFramePtr;
export const getCGBGameFramePtr = backend.getCGBGameFramePtr;
export const setVerbose = backend.setVerbose;
export const spliceLogs = backend.spliceLogs;
export const dumpLogToConsole = backend.dumpLogToConsole;
export const attachDebugger = backend.attachDebugger;
export const detachDebugger = backend.detachDebugger;
export const debugStep = backend.debugStep;
export const debugSetBreakpoint = backend.debugSetBreakpoint;
export const debugSetPPUBreak = backend.debugSetPPUBreak;
export const debugHasBreakpoint = backend.debugHasBreakpoint;
export const getActiveBreakpoints = backend.getActiveBreakpoints;
export const getDebugInfo = backend.getDebugInfo;
export const serialEnableLog = backend.serialEnableLog;
export const extractMetadata = backend.extractMetadata;
export const loadBootRom = backend.loadBootRom;
export const hexDump = backend.hexDump;
export const TOTAL_MEMORY_SIZE = backend.TOTAL_MEMORY_SIZE;
export const loadCartridgeRom = backend.loadCartridgeRom;
export const isCgbMode = backend.isCgbMode;
export const isDoubleSpeed = backend.isDoubleSpeed;
export const getGameboyTileExampleData = backend.getGameboyTileExampleData;
export const getTestExampleData = backend.getTestExampleData;
export const drawTileData = backend.drawTileData;
export const drawBackgroundMap = backend.drawBackgroundMap;
export const getBGTileMap = backend.getBGTileMap;
export const getOAMTiles = backend.getOAMTiles;
export const disassembleBoot = backend.disassembleBoot;
export const disassembleCartridge = backend.disassembleCartridge;
export const getBootLines = backend.getBootLines;
export const getCartLines = backend.getCartLines;
export const setJoypad = backend.setJoypad;
export const loadSaveGame = backend.loadSaveGame;
export const getLastSave = backend.getLastSave;
export const getLastSaveFrame = backend.getLastSaveFrame;
export const createSaveState = backend.createSaveState;
export const loadSaveState = backend.loadSaveState;
export const isAtFrameBoundary = backend.isAtFrameBoundary;
export const getAudioSampleRate = backend.getAudioSampleRate;
export const getAudioBuffersSize = backend.getAudioBuffersSize;
export const getAudioBuffersToReadCount = backend.getAudioBuffersToReadCount;
export const getAudioBufferToReadPointer = backend.getAudioBufferToReadPointer;
export const markAudioBuffersRead = backend.markAudioBuffersRead;
export const setMuteChannel = backend.setMuteChannel;
export const setMasterAudioToggle = backend.setMasterAudioToggle;

export function getGameFrameView(): Uint8Array {
    return new Uint8Array(sharedMemory.buffer as ArrayBuffer, backend.getGameFramePtr(), 160 * 144);
}

export function getCgbGameFrameView(): Uint16Array {
    return new Uint16Array(sharedMemory.buffer as ArrayBuffer, backend.getCGBGameFramePtr(), 160 * 144);
}

export function getAudioBufferView(ptr: number, sampleCount: number): Float32Array<ArrayBuffer> {
    return new Float32Array(sharedMemory.buffer as ArrayBuffer, ptr, sampleCount);
}
