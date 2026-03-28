# SvelteBoy - Project Architecture

## Overview

Full GameBoy DMG (classic) emulator running in the browser:
- **Backend**: AssemblyScript → WASM (`/assembly/`)
- **Frontend**: Svelte 5 + Vite (`/src/`)

## Build System

```bash
# AssemblyScript → WASM
npm run asbuild:debug        # with sourcemaps & debug info
npm run asbuild:debugrelease # optimized + debug symbols
npm run asbuild:release      # full optimization

# Frontend
npm run dev    # dev server
npm run build  # production dist
npm test       # test suite
```

**Output**: `build/backend.wasm`, `build/backend.js` (ESM bindings), `build/backend.d.ts`

Config: `asconfig.json` (AS targets, memoryBase=8491076), `vite.config.ts` (Svelte + polyfills)

---

## Backend: `/assembly/`

### File Tree

```
assembly/
├ index.ts              ← WASM public API (all exports)
├ emulator.ts           ← main loop & state machine
├ cartridge.ts          ← ROM loading & metadata
├ constants.ts          ← CPU clock (4.19MHz), 60 FPS
├ metadata.ts           ← ROM header parsing
│
├ cpu/
│ ├ cpu.ts            ← registers, state, flags
│ ├ alu.ts            ← arithmetic/logic unit
│ ├ cpuOps.ts         ← instruction implementations
│ ├ interrupts.ts     ← interrupt requests/handling
│ └ opcodes.ts        ← decode tables (256 + 256 CB-prefix)
│
├ io/
│ ├ io.ts             ← I/O dispatcher
│ ├ joypad.ts         ← D-Pad & button input
│ ├ serial.ts         ← serial port (debug output)
│ ├ timer.ts          ← DIV, TIMA timer
│ └ video/
│   ├ ppu.ts        ← Pixel Processing Unit
│   ├ lcd.ts        ← LCD control registers
│   ├ oam.ts        ← Sprite Attribute Memory
│   ├ pixelFifo.ts  ← pixel pipeline
│   ├ scanlineRenderer.ts
│   ├ ppuTransfer.ts
│   ├ dma.ts        ← DMA transfers
│   ├ fifo.ts       ← FIFO buffer
│   ├ tileUtils.ts
│   └ constants.ts  ← 160×144 LCD, palettes
│
├ audio/
│ ├ apu.ts            ← Audio Processing Unit core
│ ├ render.ts         ← sample rendering
│ ├ audioBuffer.ts    ← double-buffered output
│ ├ audioRegisters.ts ← NR50-FF3F sound control
│ ├ PulseChannel.ts   ← CH1 & CH2 (pulse waves)
│ ├ WaveChannel.ts    ← CH3 (custom waveform)
│ ├ NoiseChannel.ts   ← CH4 (noise)
│ ├ AudioChannelBase.ts
│ ├ audioTypes.ts
│ ├ eventQueue.ts
│ ├ AudioData.ts
│ └ Uint4Array.ts     ← custom 4-bit array
│
├ memory/
│ ├ memoryMap.ts      ← address space mapping
│ ├ memoryConstants.ts← memory layout constants
│ ├ cartridge.ts      ← ROM/RAM bank mapping
│ ├ mbc.ts            ← MBC dispatcher
│ ├ mbc1.ts / mbc2.ts / mbc3.ts  ← bank controllers
│ ├ mbcTypes.ts
│ ├ noMbc.ts          ← ROM-only carts
│ └ savegame.ts       ← save persistence
│
├ debug/
│ ├ debugger.ts       ← breakpoints & step control
│ ├ debugInfo.ts      ← CPU/PPU/Timer snapshots
│ ├ disassemble.ts    ← Z80 disassembler
│ ├ logger.ts         ← log system with filters
│ └ symbols.ts        ← mnemonic/register names
│
├ tests/                ← comprehensive test suite
│ ├ cpuTests.ts, registerTests.ts, memoryTests.ts
│ ├ interruptTests.ts, programTests.ts, fifoTests.ts
│ ├ pixelFifoTests.ts, miscTests.ts, Uint4ArrayTests.ts
│ ├ instructions/     ← per-opcode test suites
│ └ video/
│
└ utils/
  ├ bytereader.ts
  ├ stringUtils.ts
  └ inlinedArray.ts
```

### WASM Memory Layout

| Offset | Size | Purpose |
|--------|------|---------|
| 0x00000000 | 0x4000 | Video RAM (8KB + 8KB CGB bank) |
| 0x00004000 | 0x00A0 | OAM (Sprite Attribute Memory) |
| 0x000040A0 | 0x80000 | External RAM (cartridge, max 16 banks) |
| 0x000840A0 | 0x8000 | Work RAM (8KB + 7 CGB banks) |
| 0x0010C0A0 | 0x0080 | I/O Registers |
| 0x0010C120 | 0x0080 | High RAM |
| 0x0010C1A4 | 0x0A00 | Boot ROM |
| 0x0010CBA4 | 0x7E0400 | Cartridge ROM (up to 8MB) |

---

## Frontend: `/src/`

### File Tree

```
src/
├ main.ts               ← app entry point (mounts Svelte)
├ App.svelte            ← root component
├ emulator.ts           ← WASM bridge & animation loop
├ debug.ts              ← debug helpers
├ inputs.ts             ← keyboard input handlers
├ types.ts              ← TypeScript types
├ utils.ts
├ cartridgeNames.ts     ← known game metadata
├ app.css
│
├ assets/
│ └ homebrews.ts      ← homebrew ROM list
│
├ lib/                  ← UI Components
│ ├ Player.svelte     ← main game container
│ ├ PlayCanvas.svelte ← 160×144 render canvas
│ ├ PlayerControls.svelte
│ ├ LocalInputViewer.svelte ← on-screen controls
│ ├ RomDropZone.svelte
│ ├ RomList.svelte / RomView.svelte / RomsSection.svelte
│ ├ SavesViewer.svelte
│ ├ OptionsView.svelte
│ └ debug/            ← debugger UI components
│   ├ Debugger.svelte
│   ├ DebugControlBar.svelte
│   ├ CpuDebugInfo.svelte / CpuFlagsView.svelte
│   ├ Disassembler.svelte / DebuggerLine.svelte
│   ├ HexView.svelte / HexDumpControl.svelte
│   ├ RegisterView.svelte
│   ├ LogView.svelte
│   ├ OamView.svelte
│   ├ BGCanvas.svelte
│   ├ FPSCounter.svelte / BenchmarkControl.svelte
│   ├ BreakpointsControl.svelte / PPUBreakControl.svelte
│   ├ ForceInputControl.svelte
│   └ AudioTests.svelte / AudioDebug.svelte
│
└ stores/
  ├ index.ts
  ├ playStores.ts     ← GameFrames, KeyPressMap, emulator state
  ├ debugStores.ts    ← breakpoints, logs
  ├ optionsStore.ts   ← volume, pixel size, FPS
  ├ romStores.ts      ← loaded cartridge ref
  └ localStorageStore.ts ← persistent storage wrapper
```

---

## Timing Constants

| Constant | Value |
|----------|-------|
| CPU Clock | 4,194,162 Hz |
| Frame Rate | 60 Hz |
| Cycles/Frame | ~69,903 |
| LCD Resolution | 160×144 px |
| Scanline Cycles | 456 M-cycles |
| Audio Sample Rate | 44,100 Hz |
| Max ROM Size | 8 MB |
| Max RAM Size | 128 KB |

## Supported Cartridge Types

- ROM-only (no MBC)
- MBC1 (most common)
- MBC2
- MBC3 (with RTC support)
- Battery saves where applicable
