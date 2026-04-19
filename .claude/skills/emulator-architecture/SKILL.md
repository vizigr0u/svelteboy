---
name: emulator-architecture
description: Prime context for architectural discussions about SvelteBoy's design patterns, component interactions, timing model, and trade-offs vs. general emulator approaches
---

## Main loop (`assembly/emulator.ts`)

`Emulator.Tick()`: CPU-driven catch-up per instruction.
```
cycles = Cpu.Tick()
Timer.Tick(cycles)
Ppu.Tick() × cycles   (1 dot/T-cycle)
Dma.Tick() if active
```
`Run(timeMs)` / `RunFrames(n)` loop on `Tick()` until `GetStopReason() != None`.

## Component sync strategies

**CPU/PPU/Timer/DMA**: instruction-boundary catch-up; tightly coupled via returned cycle count.

**APU**: decoupled event-queue. CPU writes to audio registers → `AudioRender.EnqueueEvent(type, val)` with timestamp `(CycleCount - init) * SAMPLE_RATE / CYCLES_PER_SECOND`. End-of-frame `AudioRender.Render()` replays queue, synthesizing between event timestamps. Decouples synthesis from emulation speed.

## PPU (`assembly/io/video/ppu.ts`)

Full pixel FIFO pipeline, not scanline-at-end. State machine: OAMScan (80 dots) → Transfer (172–289 dots, variable due to sprite/window stalls) → HBlank → VBlank (lines 144–153). Variable Mode 3 duration captures mid-scanline effects correctly.

## Timer (`assembly/io/timer.ts`)

16-bit `internalDiv` increments every T-cycle. TIMA increments on watched-bit 1→0 transition:

| TAC | bit | freq |
|-----|-----|------|
| 00 | 9 | 4 kHz |
| 01 | 3 | 256 kHz |
| 10 | 5 | 64 kHz |
| 11 | 7 | 16 kHz |

Writing DIV resets `internalDiv` to 0 — can spuriously increment TIMA if watched bit was 1.

## Memory bus (`assembly/memory/memoryMap.ts`)

- Raw `load`/`store` for VRAM/WRAM/OAM/HRAM (precomputed WASM offsets, no dispatch)
- `GBload`/`GBstore` dispatched gate for IO/cartridge/bootrom → `io.ts` routes by address
- MBC1/2/3 in `assembly/memory/mbc*.ts` behind common interface

## Component model

All components (`Cpu`, `Ppu`, `Apu`, `Timer`, `MemoryMap`, `AudioRender`) are `@final` static classes — no instantiation. Circular references (CPU↔MMU↔PPU) are direct static calls. Static fields at known WASM offsets; cache-friendly.

## Timing accuracy

- PPU ticked 4×/M-cycle (required for STAT interrupt timing)
- Conditional branches return actual cycles taken
- EI delay: `Cpu.isEnablingIME` — IME takes effect after next instruction
- Interrupts: all components call `Interrupt.Request(IntType.X)`; CPU polls `Interrupt.HandleInterrupts()` each tick
- Register writes land immediately; Transfer reads current values — raster effects work correctly

## Per-frame call counts (~69,905 T-cycles, ~17,476 instructions)

`Ppu.Tick()` dominates (~69,905 calls). Most OAMScan/HBlank calls are no-ops (dot increment only).

$ARGUMENTS
