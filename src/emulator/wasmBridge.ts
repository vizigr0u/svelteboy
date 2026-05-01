// Bridge between Svelte/UI code and the AssemblyScript backend.
// Eagerly instantiates the backend onto a JS-provided shared WebAssembly.Memory,
// then re-exports lifted functions and helper views so existing call sites stay sync.
//
// B2 will move WASM hosting into a worker; consumers should migrate to async APIs.
// Until then this module keeps the legacy import shape working.

import { loadBackend, createSharedMemory, type BackendInstance } from './backendLoader';

const sharedMemory = createSharedMemory();
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
