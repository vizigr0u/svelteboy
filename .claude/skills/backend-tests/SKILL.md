---
name: backend-tests
description: Guide for writing AssemblyScript backend tests in assembly/tests/ — patterns, helpers, ROM setup, and wiring
argument-hint: [optional: what you're testing, e.g. "timer", "interrupt", "new opcode"]
---

You are writing tests for the **AssemblyScript backend** of SvelteBoy.

## Test Infrastructure Overview

```
assembly/tests/          ← one file per feature area
tests/index.js           ← JS harness: calls WASM exports, logs pass/fail
assembly/index.ts        ← must re-export every new test function
```

Each test file exports **one boolean function** (`testXxx(): boolean`). It calls internal helper functions, uses `assert()` for validation, and returns `true` on success. A failed assert aborts immediately.

---

## Minimal Test File Template

```typescript
import { Emulator } from "../emulator";
import { Cpu } from "../cpu/cpu";
import { setTestRom } from "./cpuTests";   // core setup helper

function testMyFeature(): void {
    setTestRom([0x3C]);       // INC A
    Cpu.SetA(0x01);
    Cpu.Tick();
    assert(Cpu.A() == 0x02, `Expected 0x02, got ${Cpu.A()}`);
}

export function testMyModule(): boolean {
    testMyFeature();
    // add more test functions here
    return true;
}
```

---

## Core Helper: `setTestRom(instructions: Array<u8>)`

Defined in `assembly/tests/cpuTests.ts`. Copies raw GB opcodes into the boot ROM area and calls `Emulator.Init(true)`.

```typescript
import { setTestRom } from "./cpuTests";

setTestRom([0x04]);           // INC B — single instruction
setTestRom([0xCB, 0x40]);     // BIT 0, B — prefixed instruction
setTestRom([
    0x31, 0xFE, 0xFF,         // LD SP, $FFFE
    0xAF,                      // XOR A
    0x21, 0xFF, 0x9F,          // LD HL, $9FFF
]);
```

`setTestRom` also tracks opcode coverage for `getCpuTestSessionSummary()`.

---

## Emulator Init Modes

| Mode | Call | Use when |
|------|------|----------|
| Boot ROM mode | `Emulator.Init(true)` (default via `setTestRom`) | Testing individual opcodes / CPU state |
| Cartridge mode | `Emulator.Init(false)` | Integration tests running full programs |

For cartridge mode, set up memory manually:

```typescript
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";

function setupRomProgram(instructions: Array<u8>): void {
    memory.fill(CARTRIDGE_ROM_START, 0, 0x100);              // clear header area
    memory.copy(
        CARTRIDGE_ROM_START + 0x100,                         // entry point
        instructions.dataStart,
        instructions.length
    );
    MemoryMap.loadedCartridgeRomSize = instructions.length;
    Emulator.Init(false);
}
```

---

## CPU Execution

```typescript
// Execute one instruction (returns T-cycle count)
Cpu.Tick();

// Execute N instructions
for (let i = 0; i < 10; i++) Cpu.Tick();

// Run until PC reaches target
for (let i = 0; Cpu.ProgramCounter != 0x000C; i++) {
    assert(i < 10000, "Runaway execution");
    Cpu.Tick();
}
```

To tick **all subsystems** together (CPU + Timer + PPU + DMA):

```typescript
import { Emulator } from "../emulator";
Emulator.Tick();   // fires all subsystems for one M-cycle
```

Use `Cpu.Tick()` for focused CPU/opcode tests. Use `Emulator.Tick()` when Timer, PPU, or interrupts must fire.

---

## CPU State Access

```typescript
// Registers (read)
Cpu.A(), Cpu.B(), Cpu.C(), Cpu.D(), Cpu.E(), Cpu.H(), Cpu.L()
Cpu.AF(), Cpu.BC(), Cpu.DE(), Cpu.HL()
Cpu.ProgramCounter    // u16
Cpu.StackPointer      // u16
Cpu.CycleCount        // u64 — total T-cycles executed

// Registers (write)
Cpu.SetA(value: u8), Cpu.SetB(value: u8), ...
Cpu.SetAF(value: u16), Cpu.SetBC(value: u16), ...

// Flags
Cpu.FlagZ(), Cpu.FlagN(), Cpu.FlagH(), Cpu.FlagC()   // boolean getters
```

---

## Memory Access in Tests

```typescript
import { MemoryMap } from "../memory/memoryMap";

// GameBoy address space (goes through full MMU)
MemoryMap.GBstore<u8>(0xFF05, 0x00);   // write TIMA
const val = MemoryMap.GBload<u8>(0xFF05);

// Raw WASM linear memory (bypass MMU)
store<u8>(ptr, value);
load<u8>(ptr);
memory.copy(dest, src, length);
memory.fill(dest, value, length);
```

---

## Interrupt Tests Pattern

For testing interrupt handlers, write both the main program and the handler vector:

```typescript
import { Interrupt, IntType } from "../cpu/interrupts";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";

function setIntProgram(int: IntType, instructions: Array<u8>): void {
    const handlerAddr: u16 = Interrupt.GetHandlerAddress(int);
    memory.copy(
        CARTRIDGE_ROM_START + handlerAddr,
        instructions.dataStart,
        instructions.length
    );
}

function testTimerInterrupt(): void {
    setupRomProgram([
        0xFB,             // EI
        0x3E, 0x04,       // LD A, 0x04  (enable timer interrupt)
        0xE0, 0xFF,       // LDH ($FF), A  → IE register
        0x76,             // HALT
    ]);
    setIntProgram(IntType.Timer, [
        0x3C,             // INC A
        0xC9,             // RETI
    ]);

    for (let i = 0; i < 1000; i++) {
        Emulator.Tick();
        if (Cpu.ProgramCounter == 0x0010) break;
    }
    assert(Cpu.A() > 0, "Interrupt handler should have incremented A");
}
```

---

## Wiring a New Test Suite

**Step 1** — create `assembly/tests/myFeatureTests.ts` with the exported function.

**Step 2** — re-export from `assembly/index.ts`:

```typescript
export { testMyModule } from "./tests/myFeatureTests";
```

**Step 3** — add a call in `tests/index.js`:

```javascript
const { testMyModule } = wasm;
test(testMyModule);
```

**Step 4** — rebuild and run:

```bash
pnpm run asbuild:debug
pnpm test
```

---

## Assertions

```typescript
assert(condition);
assert(condition, `descriptive message with ${value}`);
```

A failing assert throws immediately — no teardown, no recovery. Put the most specific assertions last so earlier failures are easier to diagnose.

---

## Common Pitfalls

- **Forgot `Emulator.Init()`**: `setTestRom()` calls it for you; cartridge-mode tests must call `Emulator.Init(false)` manually after setting up memory.
- **Stale state between tests**: `setTestRom()` resets the emulator. For cartridge-mode tests, always call `Emulator.Init(false)` at the start of each sub-test.
- **PPU/Timer not firing**: `Cpu.Tick()` only ticks the CPU. Use `Emulator.Tick()` when timing-sensitive hardware must advance.
- **Missing re-export**: Adding a test function without updating `assembly/index.ts` means `tests/index.js` can't call it.
- **New file not imported in tests**: `tests/index.js` must explicitly call the new exported test function.

$ARGUMENTS
