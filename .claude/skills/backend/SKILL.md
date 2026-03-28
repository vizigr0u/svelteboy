---
name: backend
description: Prime context for working on the AssemblyScript/WASM GameBoy emulator backend in /assembly/
argument-hint: [optional: specific area, e.g. "cpu", "ppu", "audio", "memory"]
---

You are working on the **AssemblyScript backend** of SvelteBoy, a GameBoy DMG emulator that compiles to WebAssembly.

## Key Facts

- Language: **AssemblyScript** (TypeScript-like, compiles to WASM via `asc`)
- Entry point / public API: `assembly/index.ts` — all exports must be declared here
- Main loop: `assembly/emulator.ts` — `Emulator.Run()` ticks CPU, Timer, PPU, DMA each cycle
- Build: `pnpm run asbuild:debug` (dev) or `pnpm run asbuild:release` (prod)
- Output: `build/backend.wasm` + `build/backend.js` (auto-generated ESM bindings)
- Tests: `pnpm test` — runs suites in `assembly/tests/`

## Module Map

| Area | Path | Key files |
|------|------|-----------|
| CPU | `assembly/cpu/` | `cpu.ts` (registers/state), `opcodes.ts` (256+256 CB-prefix decode), `alu.ts`, `interrupts.ts` |
| PPU | `assembly/io/video/` | `ppu.ts` (main renderer), `scanlineRenderer.ts`, `pixelFifo.ts`, `oam.ts`, `dma.ts` |
| APU | `assembly/audio/` | `apu.ts` (core), `render.ts` (sample gen), `PulseChannel.ts`, `WaveChannel.ts`, `NoiseChannel.ts` |
| Memory | `assembly/memory/` | `memoryMap.ts` (address dispatch), `mbc1/2/3.ts` (bank controllers), `savegame.ts` |
| I/O | `assembly/io/` | `joypad.ts` (input), `timer.ts` (DIV/TIMA), `serial.ts` |
| Debug | `assembly/debug/` | `debugger.ts` (breakpoints), `debugInfo.ts` (snapshots), `disassemble.ts` |

## WASM Memory Layout (linear, flat)

```
0x00000000  VRAM       (16KB)
0x00004000  OAM        (160B)
0x000040A0  Ext RAM    (512KB, cartridge)
0x000840A0  Work RAM   (32KB)
0x0010C0A0  I/O Regs   (128B)
0x0010C120  High RAM   (128B)
0x0010CBA4  Cart ROM   (up to 8MB)
```

## AssemblyScript Gotchas

- No closures capturing `this` — use module-level functions or static class methods
- Typed arrays are value types: `Uint8Array`, `Int16Array`, etc. are first-class
- `memory.data<u8>(offset)` for direct memory reads; use `store<u8>(ptr, val)` / `load<u8>(ptr)` for raw access
- No `Map`/`Set` generics with reference types — use `StaticArray` or custom structures
- Exported functions must be in `assembly/index.ts` or re-exported from it
- `@inline` decorator for hot-path functions (CPU tick, PPU tick)

## Adding a New Export

1. Implement in the relevant module (e.g. `assembly/audio/apu.ts`)
2. Export from `assembly/index.ts`: `export { myFunction } from "./audio/apu"`
3. Rebuild: `pnpm run asbuild:debug`
4. TypeScript types auto-update in `build/backend.d.ts`
5. Import in frontend: `import { myFunction } from "../build/backend"`

## Timing Reference

- CPU: 4,194,162 Hz — each `CPU.Tick()` advances 1 M-cycle (4 T-cycles)
- PPU: 456 M-cycles per scanline, 154 scanlines per frame → ~69,903 cycles/frame
- Audio: 44,100 Hz sample rate; APU writes samples into double-buffered output

## Running Tests

```bash
pnpm test                    # all suites
# Individual suites called via testCpu(), testVideo(), etc. (also WASM exports)
```

$ARGUMENTS
