memory.grow(1);

import { Emulator } from "./emulator";
import { MemoryMap } from "./memoryMap";

export { setVerbose, spliceLogs, dumpLogToConsole } from "./logger";

export {
  debugRunFrame,
  debugStep,
  debugPause,
  debugGetStatus,
  debugSetBreakpoint,
  debugHasBreakpoint,
  getActiveBreakpoints
} from "./debug";

export { serialEnableLog } from "./serial";

export { extractMetadata } from "./metadata";

export { loadBootRom, loadCartridgeRom, TOTAL_MEMORY_SIZE } from './memoryMap';

export function runCartridge(): void {
  Emulator.Init(false);
  Emulator.Loop();
}

export function init(useBootRom: boolean = true): void {
  Emulator.Init(MemoryMap.loadedBootRomSize > 0 && useBootRom);
}

export function runOneFrame(maxCycles: u32): void {
  Emulator.RunOneFrame(maxCycles);
}

export function hexDump(from: u16, to: u16): Uint8Array {
  if (to <= from) {
    console.log("Invalid parameters for hexDump");
    return new Uint8Array(0);
  }
  const result = new Uint8Array(to - from);
  const oldUseBoot = MemoryMap.useBootRom;
  MemoryMap.useBootRom = false;
  memory.copy(result.dataStart, MemoryMap.GBToMemory(from), (to - from + 1));
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

export {
  getGameboyTileExampleData,
  getPokemonTileExampleData,
  getLetterTileExampleData,
  getTestExampleData,
  drawVideoBuffercontent
} from "./video/tileUtils";

export {
  disassembleBoot,
  disassembleCartridge,
  getBootLines,
  getCartLines
} from "./disassemble";
