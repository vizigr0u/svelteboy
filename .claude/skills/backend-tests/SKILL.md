---
name: backend-tests
description: Guide for writing AssemblyScript backend tests in assembly/tests/ — patterns, helpers, ROM setup, and wiring
argument-hint: [optional: what you're testing, e.g. "timer", "interrupt", "new opcode"]
---

Always consult Pan Docs (`pandocs/src/`, via `gameboy-docs` skill) for expected flag effects, cycle counts, and register behavior. Never guess hardware behavior.

## Structure

```
assembly/tests/framework.ts          ← assert helpers
assembly/tests/cpuTests.ts           ← setTestRom, register lambdas
assembly/tests/instructions/         ← per-opcode suites → index.ts → testInstructions()
assembly/tests/<feature>Tests.ts     ← other suites
assembly/index.ts                    ← re-export all test functions
tests/index.js                       ← JS harness
```

Each suite exports one `testXxx(): boolean`. Uses `describe`/`it` blocks. Returns `true`; a failed assert aborts immediately.
the js harness calls all test functions based on name (starts with 'test'), reports pass/fail, and tracks opcode coverage via `setTestRom`.

## Framework (`assembly/tests/framework.ts`)

```typescript
describe(name, fn), beforeEach(fn), it(name, fn)
assertEquals<T>(actual, expected, label)
assertReg(actual: u8, expected: u8, name)
assertMem(addr: u16, expected: u8)         // GBload check
assertFlags(z, n, h, c: bool)             // all four flags
assertCycles(expected: u64)               // Cpu.CycleCount since last setTestRom
ctx()                                      // "[suite › case] " for manual asserts
```

## Setup

```typescript
import { setTestRom } from "../cpuTests";  // or "./cpuTests" from tests/ root
setTestRom([0x04]);          // resets emulator, tracks opcode coverage, Emulator.Init(true)
setTestRom([0xCB, 0x40]);    // prefixed
```

Register lambda helpers from `cpuTests.ts`: `BC, DE, HL, SP, SetBC, SetDE, SetHL, SetSP`.

## Execution

```typescript
Cpu.Tick();       // CPU only — use for opcode tests
Emulator.Tick();  // CPU + Timer + PPU + DMA — use when timing/interrupts matter
```

## CPU API

```typescript
// Read: Cpu.A()…Cpu.L(), Cpu.F(), Cpu.AF/BC/DE/HL (fields), Cpu.ProgramCounter, Cpu.StackPointer, Cpu.CycleCount
// Write: Cpu.SetA(v)…, Cpu.AF=v…, Cpu.SetF(flags), Cpu.SetFlag(Flag.Z_Zero)
// Flags: Cpu.FlagZ(), Cpu.FlagN(), Cpu.FlagH(), Cpu.FlagC()
```

## Memory

```typescript
MemoryMap.GBstore<u8>(addr, val); MemoryMap.GBload<u8>(addr);  // through MMU
store<u8>(ptr, val); load<u8>(ptr); memory.copy/fill(…);       // raw WASM (rare)
```

Use `0xFF82` as scratch HRAM in tests.

## Cartridge-mode (multi-instruction programs)

```typescript
memory.fill(CARTRIDGE_ROM_START, 0, 0x100);
memory.copy(CARTRIDGE_ROM_START + 0x100, instructions.dataStart, instructions.length);
MemoryMap.loadedCartridgeRomSize = instructions.length;
Emulator.Init(false);
// guard runaway: assert(i < 10000, "Runaway") inside loop
```

## Wiring a new suite

1. `assembly/tests/myFeatureTests.ts` — export `testMyFeature(): boolean`
2. `assembly/index.ts` — `export { testMyFeature } from "./tests/myFeatureTests"`
3. `tests/index.js` — call it following existing pattern
4. `pnpm run asbuild:debug && pnpm test`

New instruction suites go in `assembly/tests/instructions/`, imported in `index.ts` → called from `testInstructions()` (already wired).

## Pitfalls

- `setTestRom` resets all state. Cartridge-mode tests call `Emulator.Init(false)` manually.
- `Cpu.Tick()` doesn't advance Timer/PPU. Use `Emulator.Tick()` for timing-sensitive tests.
- Cycle counts from Pan Docs — `assertCycles` will catch mismatches.

$ARGUMENTS
