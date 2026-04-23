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

// #strip-start
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
export { testHalt } from './tests/haltTests';
export { testFifo } from './tests/fifoTests';
export { testPixelFifo } from './tests/pixelFifoTests';
export { testUint4Array } from './tests/Uint4ArrayTests';
export { testAudioRegisters } from './tests/audioRegisterTests';
export { testPulseChannel } from './tests/pulseChannelTests';
export { testWaveChannel } from './tests/waveChannelTests';
export { testNoiseChannel } from './tests/noiseChannelTests';
export { testAudioRender } from './tests/audioRenderTests';
export { testMbc } from './tests/mbcTests';
export { testSerial } from './tests/serialTests';
export { testMetadata } from './tests/metadataTests';
export { testEmulator } from './tests/emulatorTests';
export { testTimer } from './tests/timerTests';
export { testJoypad } from './tests/joypadTests';
export { testPowerUp } from './tests/powerUpTests';
// #strip-end

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

// #strip-start
import { ScanlineRenderer } from "./io/video/scanlineRenderer";
export function instrumentedDiag(): void {
    ScanlineRenderer.RenderDiag();
}
// #strip-end
