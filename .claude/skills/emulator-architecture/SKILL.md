---
name: emulator-architecture
description: Prime context for architectural discussions about SvelteBoy's design patterns, component interactions, timing model, and trade-offs vs. general emulator approaches
---

You are discussing the **architecture** of SvelteBoy, a GameBoy DMG emulator. Use this as a reference for how the system is structured and why.

---

## Main Loop: Instruction-Granular Catch-Up

`Emulator.Tick()` in `assembly/emulator.ts` — one call per CPU instruction:

```
Cpu.Tick()               → executes one instruction, returns T-cycles (4–16)
Timer.Tick(t_cycles)     → updates internalDiv, checks for TIMA overflow
for i in 0..t_cycles:
    Ppu.Tick()           → advances one dot
    Dma.Tick()           → if active, every 4 T-cycles
```

`Emulator.Run(timeMs)` / `RunFrames(n)` loop on `Tick()` until `GetStopReason()` returns non-None.

**Pattern**: CPU drives timing; all other components catch up per instruction. This is the most common practical approach for GB emulators — accurate enough for all commercial games, avoids the overhead of true cycle-by-cycle lockstep.

---

## Component Synchronization: Two Different Strategies

### CPU / PPU / Timer / DMA — Instruction-Boundary Catch-Up
Tightly coupled: after each CPU instruction, Timer and PPU are advanced by the exact cycle count returned. PPU is ticked once per T-cycle (4 times per M-cycle) for dot-accurate mode transitions.

### APU — Retroactive Event Queue (Decoupled)
`AudioRender` in `assembly/audio/render.ts` operates offline:
- During emulation, CPU writes to audio registers → `AudioRender.EnqueueEvent(type, value)` timestamps each write as a sample index: `(Cpu.CycleCount - initialCycles) * SAMPLE_RATE / CYCLES_PER_SECOND`
- Queue is a simple FIFO (`assembly/audio/eventQueue.ts`, capacity 512) — events always arrive in chronological order
- At end of frame, `AudioRender.Render()` replays the queue, synthesizing audio in chunks between event timestamps

**Inner loop of `RenderSamples()` is a mini-scheduler**:
```
while end < bufferEnd:
    end = min(bufferEnd, nextEvent.sampleIndex)
    render all channels from start → end
    apply dequeued event
    start = end
```

This pattern decouples audio synthesis speed from emulation speed — synthesis happens once per frame regardless of how many CPU instructions ran.

---

## PPU: Full Pixel FIFO Pipeline

PPU state machine in `assembly/io/video/ppu.ts`:

```
OAMScan  (80 dots, fixed)
    ↓
Transfer (172–289 dots, VARIABLE — depends on sprites + window)
    ↓
HBlank   (remainder to dot 456)
    ↓  [repeat 144 lines]
VBlank   (lines 144–153, 10 scanlines = 4560 dots)
```

Mode-specific tick functions: `tickOAMScan()`, `tickTransfer()`, `tickHblank()`, `tickVblank()`. Transfer duration is variable because the pixel FIFO stalls on sprite fetches and window activation — this is the full pipeline implementation, not the simpler scanline-at-end approach. Captures variable Mode 3 duration and mid-scanline effects correctly.

---

## Timer: Bit-Watch on Internal Div Counter

`assembly/io/timer.ts` — **does not use a fixed prescaler**. Tracks a 16-bit `internalDiv` that increments every T-cycle. TIMA increments when a specific bit of `internalDiv` transitions 1→0:

| TAC bits | Watched bit | Effective frequency |
|---|---|---|
| 00 | bit 9 | 4 kHz |
| 01 | bit 3 | 256 kHz |
| 10 | bit 5 | 64 kHz |
| 11 | bit 7 | 16 kHz |

Writing to DIV resets the entire 16-bit `internalDiv` to 0, which can cause a spurious TIMA increment if the watched bit was 1 at the time of reset. This models the hardware accurately.

---

## Memory Bus: Tiered Hybrid

`assembly/memory/memoryMap.ts`:

- **Direct WASM memory** for pure RAM regions (VRAM, WRAM, OAM, HRAM) — zero dispatch, raw `load<u8>` / `store<u8>` into flat linear memory at precomputed offsets
- **Dispatched gate** (`GBload` / `GBstore`) for IO, cartridge, bootrom — checks address range, routes to specialized handler
- **IO dispatcher** (`assembly/io/io.ts`) routes IO-range accesses to PPU, APU, Timer, Serial, Joypad by address

MBC (Memory Bank Controllers) in `assembly/memory/mbc1/2/3.ts` abstract cartridge ROM/RAM banking behind a common interface.

---

## Component Organization: Static Singletons

All major components (`Cpu`, `Ppu`, `Apu`, `Timer`, `MemoryMap`, `AudioRender`, etc.) are `@final` static classes. No instantiation — all state lives in static fields.

**Why**: AssemblyScript has no ownership constraints, so circular references between components (CPU ↔ MemoryMap ↔ PPU) work without `Rc<RefCell<>>` overhead. Static fields live at known WASM memory offsets, improving cache behavior. The tradeoff is tight coupling via direct static calls rather than interfaces, which is acceptable for this target.

---

## Timing Accuracy

- **T-cycle granularity**: PPU ticked 4× per M-cycle; this is required for STAT interrupt timing
- **Variable-length instructions**: conditional branches (JR, JP, CALL, RET) return actual cycles taken
- **EI delay**: `Cpu.isEnablingIME` flag in `assembly/cpu/cpu.ts` — interrupt enable takes effect after the *next* instruction
- **Interrupt system**: all components call `Interrupt.Request(IntType.X)` to signal events; CPU polls `Interrupt.HandleInterrupts()` each tick

---

## Overhead Profile (per frame, ~69,905 T-cycles ≈ 17,476 instructions)

| Site | Calls/frame |
|---|---|
| `Cpu.Tick()` | ~17,476 |
| `Timer.Tick()` | ~17,476–34,952 |
| `Ppu.Tick()` | ~69,905 |
| `GetStopReason()` | ~17,476 (5 conditions each) |
| APU `EnqueueEvent` | only on audio register writes |

The dominant cost is the `Ppu.Tick()` inner loop. Most of those calls during OAMScan and HBlank increment `currentDot` and return with no side effects.

---

## Raster Effects and Timing Correctness

Games change SCX, palette, window position, LCDC during HBlank or VBlank interrupt handlers. This works correctly because:
- The CPU executes all instructions even when PPU is in HBlank/VBlank — no instructions are skipped
- Register writes land in `Lcd` / IO memory immediately at the cycle they occur
- When Transfer begins for the next scanline, it reads current register values
- Transfer (Mode 3) is the only period where mid-render timing matters, and it runs dot-by-dot via the pixel FIFO

$ARGUMENTS
