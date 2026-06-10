# Emu Template Extraction Plan

Extract SvelteBoy architecture into `svelte-emu-template` — `degit`-style skeleton repo. Generic bones kept; console-specific stripped. New emu (GBA/NES/etc.) clones template, fills stubs.

**Scope: template only.** No npm packages, no shared framework. Copy-paste drift accepted as cost of avoiding premature abstraction.

## Reusable verbatim or near-verbatim

- `src/emulator/` — rAF loop, audio queue, savestate, lifecycle, HMR, visibility (parametrize frame dims, sample rate, savestate version)
- `src/emulator/wasmBridge.ts` — pattern: re-export from `build/backend`, expose typed-array views over WASM memory
- `src/lib/debug/` — `HexView`, `RegisterView`, `LogView`, `Disassembler` shell, `DebuggerLine`, `BreakpointsControl`, `FPSCounter`, `BenchmarkControl`
- `src/stores/` — pattern: `playStores` / `debugStores` / `optionsStore` / `localStorageStore`
- `src/lib/RomDropZone.svelte`, `SavesViewer.svelte`, `Player.svelte`, `PlayerControls.svelte` shells
- `assembly/tests/` runner pattern + `index.ts` test exports
- `assembly/debug/logger.ts`, `debugger.ts` skeleton
- `assembly/utils/` (bytereader, stringUtils, inlinedArray)
- `asconfig.json` memory-region pattern (remap sizes per console)
- Conditional compilation pattern (`--use SYM=1` + `isDefined(SYM)`)
- Vite config + Svelte 5 + polyfills
- Deep-link `?rom=` plan
- AudioWorklet PoC + coi-serviceworker for GH Pages
- Save persistence layer (IDB store)

## Console-specific — expect rewrite per console

- CPU: SM83 → 6502 (NES) / ARM7TDMI+THUMB (GBA)
- Opcode tables + decoder
- PPU: nametables (NES), modes 0-5 + sprite OAM2 (GBA)
- Tile/palette format
- APU: 2A03 (pulse×2+tri+noise+DMC) / GBA direct-sound DMA channels
- Memory map regions + sizes
- MBC → mapper (NES iNES mappers) or flat (GBA)
- Interrupts model
- Timing constants (`constants.ts`)
- Input bitmask (joypad layout)
- Cartridge header parsing

## Proposed template file tree

```text
svelte-emu-template/
├ assembly/
│ ├ index.ts              ← STUB: minimal WASM exports (init/run/getFramePtr/setInput/getDebugInfo)
│ ├ emulator.ts           ← STUB: main loop scaffold w/ Cpu/Ppu/Apu hooks (empty impls)
│ ├ constants.ts          ← STUB: clock/fps/frame-cycles placeholders
│ ├ cpu/                  ← EMPTY (per-console impl)
│ ├ io/video/             ← EMPTY
│ ├ audio/                ← STUB: AudioChannelBase, eventQueue, audioBuffer KEPT; channels EMPTY
│ ├ memory/               ← STUB: memoryMap pattern KEPT; mappers EMPTY
│ ├ debug/                ← KEPT: logger, debugger skeleton, disassemble.ts STUB
│ ├ tests/                ← KEPT: runner + harness; per-console tests EMPTY
│ └ utils/                ← KEPT verbatim
├ src/
│ ├ emulator/             ← KEPT verbatim (parametrize frame dims via config)
│ ├ lib/
│ │ ├ Player.svelte       ← KEPT
│ │ ├ PlayCanvas.svelte   ← parametrize 160×144 → config
│ │ ├ RomDropZone, SavesViewer, PlayerControls ← KEPT
│ │ └ debug/              ← KEPT (HexView, RegisterView, LogView, Disassembler, FPS, Benchmark)
│ ├ stores/               ← KEPT
│ ├ inputs.ts             ← STUB: keymap config
│ ├ types.ts              ← parametrize DebugInfo shape
│ └ App.svelte            ← KEPT shell
├ build/                  ← AS output
├ asconfig.json           ← memory layout template (per-console fill)
├ vite.config.ts          ← KEPT
├ package.json            ← pnpm, AS, Svelte 5 deps
└ .claude/
  ├ project-architecture.md  ← template (fill per console)
  ├ wasm-api-and-dataflow.md ← KEPT (generic API contract)
  └ skills/                  ← KEPT (backend, frontend, audio, backend-tests)
```

## Generic WASM API contract (must hold across consoles)

```typescript
initEmulator(useBootRom?: bool) → void
runOneFrame() → EmulatorStopReason
runEmulator(timeMs: f64) → EmulatorStopReason
getGameFramePtr() → u32
setJoypad(keys: u8) → void
getDebugInfo() → DebugInfo
loadCartridgeRom(rom: ArrayBuffer) → bool
loadBootRom(rom: ArrayBuffer) → bool
loadSaveGame(save: Uint8Array) → void
getLastSave() → Uint8Array
extractMetadata(rom: ArrayBuffer) → Metadata
attachDebugger / detachDebugger / debugStep / debugSetBreakpoint / hexDump
getAudioSampleRate / getAudioBufferToReadPointer / markAudioBuffersRead / setMuteChannel
memory: WebAssembly.Memory
```

`DebugInfo`, `Metadata`, `ProgramLine` shapes parametrize per console.

## Config layer (single source of truth per console)

```typescript
// src/config.ts
export const EmuConfig = {
  frameWidth: 160, frameHeight: 144,
  cpuClockHz: 4_194_162,
  fps: 60,
  cyclesPerFrame: 69_903,
  audioSampleRate: 44_100,
  audioChannelCount: 4,
  maxRomSize: 8 * 1024 * 1024,
  maxRamSize: 128 * 1024,
  inputs: { Right:1, Left:2, Up:4, Down:8, A:16, B:32, Select:64, Start:128 },
};
```

Backend mirrors via `assembly/constants.ts`.

---

## Migration Steps (to build template)

1. Fork svelteboy → `svelte-emu-template` repo
2. Strip per-console: `cpu/`, `io/video/ppu*`, `audio/*Channel*`, `memory/mbc*`, `cartridgeNames.ts`, `assets/homebrews.ts`
3. Replace with stubs implementing generic interfaces
4. Extract magic numbers → `EmuConfig` (frontend) + `assembly/constants.ts` (backend)
5. Genericize `DebugInfo` shape — split into `CommonDebugInfo` + `ConsoleDebugInfo`
6. Genericize `PlayCanvas.svelte` dims from config
7. Genericize keymap (`inputs.ts`) — config-driven button list
8. Replace `cartridgeNames.ts` with generic ROM metadata lookup hook
9. Write `TEMPLATE-README.md`: how to fill stubs for new console
10. Add `degit` instructions
11. Verify: clone template → empty stubs → frontend boots showing black canvas + debugger UI

## Open Questions

- Savestate format: per-console versioning vs unified envelope? → unified envelope, per-console payload section.
- Boot ROM optional or required in template? → optional flag via `EmuConfig.hasBootRom`.
- Audio channel count parametric? CH-base class already generic; channels are per-console. OK.
- Test harness: keep AS-native runner or move to JS-side? → AS-native (proven, fast).
- Repo name + license + GH org? TBD.

## Next Action

When ready: create new repo, copy svelteboy@HEAD, strip per branch `template/strip`, land stubs, push as template repo. Do NOT touch svelteboy main during extraction.
