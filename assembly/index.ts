memory.grow(1);

import { Emulator } from "./emulator";
import { MemoryMap } from "./cpu/memoryMap";
import { Ppu } from "./io/video/ppu";
import { log } from "./debug/logger";
import { uToHex } from "./utils/stringUtils";

export { setVerbose, spliceLogs, dumpLogToConsole } from "./debug/logger";

export {
  debugRunFrame,
  debugStep,
  debugPause,
  debugGetStatus,
  debugSetBreakpoint,
  debugSetPPUBreak,
  debugHasBreakpoint,
  getActiveBreakpoints
} from "./debug/debug";

export { serialEnableLog } from "./io/serial";

export { extractMetadata } from "./metadata";

export { loadBootRom } from './cpu/memoryMap';
export { TOTAL_MEMORY_SIZE } from './cpu/memoryConstants';

export { loadCartridgeRom } from './cartridge';

export function runCartridge(useBootRom: boolean = true): void {
  Emulator.Init(useBootRom);
  Emulator.Loop();
}

export function init(useBootRom: boolean = true): void { Emulator.Init(useBootRom); }

export function runOneFrame(): void { Emulator.RunOneFrame(); }

export function getGameFrame(buffer: Uint8ClampedArray): Uint8ClampedArray {
  const ppuBuffer = Ppu.DrawnBuffer();
  assert(ppuBuffer.byteLength <= buffer.byteLength, "Not enough space to copy frame buffer");
  return ppuBuffer;
}

export function hexDump(from: u16, count: u16): Uint8Array {
  const result = new Uint8Array(count);
  const oldUseBoot = MemoryMap.useBootRom;
  MemoryMap.useBootRom = false;
  memory.copy(result.dataStart, MemoryMap.GBToMemory(from), count);
  MemoryMap.useBootRom = oldUseBoot;
  return result;
}

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

export {
  getGameboyTileExampleData,
  getPokemonTileExampleData,
  getLetterTileExampleData,
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
