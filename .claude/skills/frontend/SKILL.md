---
name: frontend
description: Prime context for working on the Svelte 5 frontend in /src/ — components, stores, WASM bridge, audio, canvas rendering
argument-hint: "optional: specific area, e.g. debugger, audio, canvas, stores"
---

You are working on the **Svelte 5 frontend** of SvelteBoy, a GameBoy DMG emulator.

## Key Facts

- Framework: **Svelte 5** with runes (`$state`, `$derived`, `$effect`)
- Dev: `pnpm run dev` | Build: `pnpm run build`
- WASM bridge: `src/emulator/` module — re-exports `build/backend` via `wasmBridge.ts`, facade in `index.ts`
- State management: Svelte stores in `src/stores/`

## File Map

| File/Dir | Purpose |
|----------|---------|
| `src/emulator/index.ts` | `Emulator`+`Debug` facades, re-exports `AudioSuspended`/`FrameStats`/`RenderFrames` |
| `src/emulator/wasmBridge.ts` | re-export `build/backend`, frame/audio typed-array views |
| `src/emulator/loop.ts` | `requestAnimationFrame` loop, pre/postRun, FrameStats, callbacks |
| `src/emulator/audio.ts` | AudioContext, queue, fade, mute subs, `suspendAudio`/`resumeAudio` |
| `src/emulator/lifecycle.ts` | pause/unpause/reset/runUntilBreak, visibility, HMR |
| `src/emulator/saveState.ts` | QuickSave/QuickLoad + thumbnails |
| `src/emulator/rom.ts` | playRom, getRomBuffer, loadSaveGame |
| `src/inputs.ts` | Keyboard → joypad bitmask → `setJoypad()` WASM call |
| `src/types.ts` | TypeScript types mirroring WASM-exported shapes |
| `src/stores/playStores.ts` | `GameFrames`, `KeyPressMap`, emulator running state |
| `src/stores/debugStores.ts` | Breakpoints, logs, debug info reactive state |
| `src/stores/optionsStore.ts` | Volume, pixel size, FPS target |
| `src/stores/romStores.ts` | Loaded cartridge reference |
| `src/lib/Player.svelte` | Top-level game player container |
| `src/lib/PlayCanvas.svelte` | 160×144 `<canvas>` — receives `Uint8ClampedArray` frame, calls `putImageData` |
| `src/lib/PlayerControls.svelte` | Play/Pause/Reset buttons |
| `src/lib/debug/Debugger.svelte` | Full debugger UI container |
| `src/lib/debug/CpuDebugInfo.svelte` | Registers, flags display |
| `src/lib/debug/Disassembler.svelte` | Disassembly view using `getCartLines()` |
| `src/lib/debug/HexView.svelte` | Memory hex dump using `hexDump()` |
| `src/lib/debug/LogView.svelte` | Serial/debug log viewer |

## Calling WASM from the Frontend

Inside `src/emulator/*` use relative `./wasmBridge`. Outside, import from `./emulator` (facade).

```typescript
// inside src/emulator/*
import {
  initEmulator, runEmulator,
  setJoypad, getDebugInfo, loadCartridgeRom,
  getGameFrameView, getCgbGameFrameView, getAudioBufferView,
  backendMemory
} from "./wasmBridge";

// Pass data TO wasm (bindings handle pointer/length automatically)
loadCartridgeRom(new Uint8Array(romArrayBuffer));

// Zero-copy frame view (helper wraps backendMemory + ptr)
const frame = getGameFrameView();   // Uint8Array(160*144) palette indices
// or RGBA (CGB): getCgbGameFrameView() — Uint16Array RGB555

// Get managed objects (copy via bindings)
const info = getDebugInfo();   // → plain JS object matching DebugInfo shape
```

## Audio Pipeline

```typescript
// Called in postRun after each emulation step
const count = getAudioBuffersToReadCount();
for (let i = 0; i < count; i++) {
  const leftPtr  = getAudioBufferToReadPointer(0);
  const rightPtr = getAudioBufferToReadPointer(1);
  const size = getAudioBuffersSize();
  // Zero-copy typed array views
  const left  = new Float32Array(backendMemory.buffer, leftPtr,  size);
  const right = new Float32Array(backendMemory.buffer, rightPtr, size);
  // Feed to Web Audio API
  const buf = audioCtx.createBuffer(2, size, getAudioSampleRate());
  buf.copyToChannel(left,  0);
  buf.copyToChannel(right, 1);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start(nextAudioTime);
  nextAudioTime += buf.duration;
}
markAudioBuffersRead(count);
```

## Emulation Loop Pattern

Loop logic in `src/emulator/loop.ts`. Audio postRun registered via `addPostRunCallback` from `audio.ts`. Render callbacks fire when ≥1 GB frame advanced this rAF tick.

```typescript
// loop.ts
function run(time: number) {
  accumulator += wallDt * get(EmulatorSpeed);
  while (accumulator >= GB_FRAME_MS && framesThisTick < MAX_CATCHUP) {
    preRun();                          // setJoypad(inputBits)
    LastStopReason.set(runEmulator(GB_FRAME_MS));
    postRun();                         // fetchLogs, GameFrames++, debug snapshot, AutoSave, postRunCallbacks
    accumulator -= GB_FRAME_MS; framesThisTick++;
  }
  if (framesThisTick > 0) renderCallbacks.forEach(cb => cb());
  if (!get(EmulatorPaused)) requestAnimationFrame(run);
}
```

`Emulator.AddRenderCallback` / `AddPostRunCallback` for components (Player, AudioDebug) to hook in.

## Svelte 5 Runes Patterns Used Here

```svelte
<script lang="ts">
  // Reactive state (replaces writable store in component)
  let frame = $state<Uint8ClampedArray | null>(null);

  // Derived (replaces $: reactive declaration)
  let isRunning = $derived(frame !== null);

  // Side effects (replaces onMount + $: with cleanup)
  $effect(() => {
    const unsub = someStore.subscribe(v => { ... });
    return () => unsub();
  });
</script>
```

## Stores: When to Use Which

| Store | Use for |
|-------|---------|
| `playStores.ts` | Emulator running state, current frame, key press map |
| `debugStores.ts` | Debug info snapshot, logs, breakpoints list |
| `optionsStore.ts` | User settings (volume, scale) — persisted to localStorage |
| `romStores.ts` | Currently loaded cartridge metadata |

## InputType Bitmask (src/inputs.ts)

```typescript
// Combined with bitwise OR, passed to setJoypad(keys)
Right=1, Left=2, Up=4, Down=8, A=16, B=32, Select=64, Start=128
```

$ARGUMENTS
