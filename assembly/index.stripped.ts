memory.grow(1);

export { initEmulator, runFrames, runOneFrame, runEmulator } from "./emulator";

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

export {
  getAudioSampleRate,
  getAudioBuffersSize,
  getAudioBuffersToReadCount,
  getAudioBufferToReadPointer,
  markAudioBuffersRead,
  setMuteChannel,
  setMasterAudioToggle,
} from './audio/render';
