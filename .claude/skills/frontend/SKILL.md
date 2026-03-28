---
name: frontend
description: Prime context for working on the Svelte 5 frontend in /src/ — components, stores, WASM bridge, audio, canvas rendering
argument-hint: [optional: specific area, e.g. "debugger", "audio", "canvas", "stores"]
---

You are working on the **Svelte 5 frontend** of SvelteBoy, a GameBoy DMG emulator.

## Key Facts

- Framework: **Svelte 5** with runes (`$state`, `$derived`, `$effect`)
- Dev: `pnpm run dev` | Build: `pnpm run build`
- WASM bridge: `src/emulator.ts` — imports everything from `build/backend`
- State management: Svelte stores in `src/stores/`
- Currently on `svelte5-migration` branch (Svelte 4 → 5 runes migration)

## File Map

| File/Dir | Purpose |
|----------|---------|
| `src/emulator.ts` | WASM bridge + `requestAnimationFrame` loop, pre/postRun hooks |
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

```typescript
import {
  initEmulator, runEmulator, getGameFramePtr,
  setJoypad, getDebugInfo, loadCartridgeRom,
  memory as backendMemory
} from "../build/backend";

// Pass data TO wasm (bindings handle pointer/length automatically)
loadCartridgeRom(new Uint8Array(romArrayBuffer));

// Get frame (zero-copy view into WASM linear memory — fast)
const ptr = getGameFramePtr();
const frame = new Uint8ClampedArray(backendMemory.buffer, ptr, 160 * 144 * 4);
canvas.putImageData(new ImageData(frame, 160, 144), 0, 0);

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

```typescript
// src/emulator.ts structure
function run(timestamp: number) {
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  preRun();                              // setJoypad(inputBits)
  const reason = runEmulator(delta);     // WASM — advances emulator by delta ms
  postRun(reason);                       // fetch frame, audio, debug info

  requestAnimationFrame(run);
}

function postRun(reason: EmulatorStopReason) {
  // Draw frame
  const ptr = getGameFramePtr();
  onFrame(new Uint8ClampedArray(backendMemory.buffer, ptr, 160 * 144 * 4));
  // Audio
  postRunAudio();
  // Debug (if debugger attached)
  if (debuggerAttached) {
    debugInfo.set(getDebugInfo());
  }
}
```

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
