memory.grow(1);

export { initEmulator, runOneFrame, runEmulator } from "./emulator";

export { getGameFrame, getGameFramePtr } from "./io/video/ppu";

export { setVerbose, spliceLogs, dumpLogToConsole } from "./debug/logger";

export {
  attachDebugger,
  detachDebugger,
  debugStep,
  debugSetBreakpoint,
  debugSetPPUBreak,
  debugHasBreakpoint,
  getActiveBreakpoints
} from "./debug/debugger";

export { getDebugInfo } from "./debug/debugInfo";

export { serialEnableLog } from "./io/serial";

export { extractMetadata } from "./metadata";

export { loadBootRom, hexDump } from './memory/memoryMap';
export { TOTAL_MEMORY_SIZE } from './memory/memoryConstants';

export { loadCartridgeRom } from './cartridge';

export { testRegisters } from "./tests/registerTests";
export { testMemory } from "./tests/memoryTests";
export {
  testCpu,
  testNop,
  resetCpuTestSession,
  getCpuTestSessionSummary
} from './tests/cpuTests';
export { testPrograms } from './tests/programTests';
export { testInstructions } from './tests/instructions';
export { testVideo } from './tests/video';
export { testMisc } from './tests/miscTests';
export { testInterrupts } from './tests/interruptTests';
export { testFifo } from './tests/fifoTests';
export { testPixelFifo } from './tests/pixelFifoTests';

export {
  getGameboyTileExampleData,
  getTestExampleData,
  drawTileData,
  drawBackgroundMap,
  getBGTileMap,
  getOAMTiles
} from "./io/video/tileUtils";

export {
  disassembleBoot,
  disassembleCartridge,
  getBootLines,
  getCartLines
} from "./debug/disassemble";

export { setJoypad } from "./io/joypad";

export { loadSaveGame, getLastSave, getLastSaveFrame } from './memory/savegame'

export { getAudioBuffersToReadCount, getAudioBuffersToReadSize, getAudioBufferToReadPointer, markAudioBuffersRead } from './audio/audio';
