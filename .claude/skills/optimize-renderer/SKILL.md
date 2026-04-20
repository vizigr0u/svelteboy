# SvelteBoy Renderer Optimization Reference

## Profiling Baseline (debugrelease build, 1500 frames, Pokemon Yellow)

| Function | Self% | Self-ms | Status |
|---|---|---|---|
| `Ppu.Tick` | 19.3% | 391.5ms | ✅ Eliminated via TickMultiple |
| `ScanlineRenderer.Render` | 12.3% | 249.7ms | ✅ Redesigned |
| `Emulator.Tick` | 11.5% | 233.9ms | ✅ Loop removed |
| `PpuOamFifo.GetSpriteIndicesFor` | 9.9% | 201.1ms | ✅ Inlined |
| `Cpu.executeNextInstruction` | 7.1% | 145ms | unchanged |

**After optimization**: PPU path 850ms → 460ms (~46% faster). Uint32Array `__uset` removed by raw `store<u32>`.

---

## Applied Optimizations

### 1. Ppu.TickMultiple — batch PPU dots per CPU instruction
**File**: `assembly/io/video/ppu.ts`

The PPU was called once per T-cycle (70,224×/frame). Most ticks just increment a counter and check a threshold.
`TickMultiple(n)` adds n to `currentDot` and fires at most one mode transition per call.
Called once per CPU instruction (~17,475×/frame) instead of once per T-cycle.

**Caveat**: Mode transitions fire up to `n-1` dots late (max 23 T-cycles). Fine for scanline renderer (already non-cycle-accurate). Not suitable if cycle-exact STAT interrupt timing is needed.

`Emulator.Tick` DMA loop: simplified to `(t_cycles >> 2)` M-cycle calls (t_cycles is always a multiple of 4).

### 2. Pre-decode sprite rows once per scanline
**File**: `assembly/io/video/scanlineRenderer.ts`

Original: for each of 160 pixels × up to 3 sprites → `load<u16>` VRAM + `getColorIndexFromBytes` per sprite per pixel.
Now: for each of ≤10 sprites at scanline start → 1 VRAM load, decode 8 pixel color IDs with xFlip applied.

Static arrays (module-level, allocated once):
```typescript
static spriteXPos:    StaticArray<u8>  = new StaticArray<u8>(10)
static spritePixels:  StaticArray<u8>  = new StaticArray<u8>(80)   // 10 × 8 decoded colors
static spritePalette: StaticArray<u8>  = new StaticArray<u8>(10)
static spriteBgPrio:  StaticArray<u8>  = new StaticArray<u8>(10)
```

Pixel offset formula: `pixOff = xFlip ? bit : (7 - bit)` maps pixelOffset→raw bit at decode time.
Inner loop just does: `unchecked(spritePixels[si * 8 + pixOff])`.

### 3. Inline GetSpriteIndicesFor into composite loop
Eliminated 160 function calls per scanline. Maintained local `spriteHead` for amortized O(1) head advancement. Same overlap semantics as original (`xPos < x` advancement, `spriteX in [x-8, x+7]` count condition, `offset in [-7, 0]` render filter, cap of 3 valid sprites).

### 4. Split BG/window render paths
When `Lcd.IsWindowVisible == false` (most frames), skip `isInWindow()` check per tile.
Fast path: tight loop with no window check.
Slow path: original logic with window check.

### 5. Precompute lo/hi bytes for tile pixel decode
```typescript
// Old: getColorIndexFromBytes(fetchedBgBytes, 1 << (7-i)) — function call per pixel
// New: hoist b >> 8 outside loop
const lo: u8 = <u8>fetchedBgBytes;
const hi: u8 = <u8>(fetchedBgBytes >> 8);
const colorId = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
```

### 6. Raw store<u32> for frame buffer writes
```typescript
// Old: unchecked(Ppu.workingBuffer[x + bufferOffset] = color32)
//      → goes through Uint32Array#__uset (was 4.6% of total)
// New:
store<u32>(workingBufferPtr + (<u32>(x + bufferOffset) << 2), color32);
```
Cache `Ppu.workingBuffer.dataStart` into a local before the pixel loop.

### 7. @inline getColorIndexFromBytes
Added `@inline` to `Ppu.getColorIndexFromBytes`. Called 8× per tile in BG decode + 8× per sprite in pre-decode phase.

### 8. Guard bounds check behind Logger.verbose
The tileByteAddress range check ran on every tile fetch (~20/scanline). Moved inside `if (Logger.verbose >= 1)` — eliminated in release builds where `Logger.verbose = 0`.

### 9. Merge composite passes
Old: 3 passes over 160 pixels (BG decode → sprite + palette → 32-bit expand).
New: 2 passes (BG decode → sprite + palette + 32-bit expand combined).

---

## Research Findings (web sources)

### Tile Data Decode Cache
**Source**: jsgroth.dev/blog/posts/gb-rewrite-pixel-fifo/, WasmBoy
Pre-decode tiles on VRAM write; render reads from pre-decoded arrays instead of raw VRAM bytes.
- Decode cost paid once per VRAM write (rare)
- Render cost: simple array lookup instead of bit-shift per pixel
- Implementation: cache `decodedTiles[tileIdx][row][col]: u8` (0-3)
- Invalidate on `writeByte` to VRAM range `0x8000–0x97FF`
- **Highest impact** remaining optimization for BG render path

### Palette Lookup Table (4-entry LUT per palette)
Instead of `applyPalette(colorId, palette) = (palette >> (colorId << 1)) & 3`:
```typescript
// Precompute at palette write time:
const bgPaletteLUT: StaticArray<u8> = [
    (palette >> 0) & 3,
    (palette >> 2) & 3,
    (palette >> 4) & 3,
    (palette >> 6) & 3,
];
// Per pixel: bgPaletteLUT[colorId]  (no shift needed)
```
Recalculate LUT only on BGP/OBP register writes.

### WASM Type Preferences
- Prefer `i32` over emulated `u8`/`u16` in tight loops; WASM operates natively on 32-bit
- `unchecked()` on every `StaticArray` and `TypedArray` access in hot loops
- `@inline` on hot helpers — AssemblyScript doesn't auto-inline class methods

### Global → Local Caching
WASM accesses local variables faster than module globals. Cache before loops:
```typescript
const tileBase = Lcd.TilesBaseAddress;  // instead of reading static field per tile
const bgMapBase = Lcd.BgTileMapBaseAddress;
```
`Lcd.TilesBaseAddress` is already a cached static field (updated on LCDC write), so this mostly matters if the accessor itself has indirection.

### Skip Rendering When PPU Disabled
If `!Lcd.IsPpuEnabled`, entire render pass can be skipped. Return early from `Render()`.

### Sprite Early-Exit on Zero Sprites
Most scanlines have 0 sprites. The `if (numSprites > 0)` guard in the pixel loop avoids all sprite overhead on blank scanlines.

### Avoid Mid-Scanline Register Changes
Latching `lcd.scrollX`, `lcd.scrollY`, `lcd.lY`, `BgPalette` once before loops rather than re-reading via `Lcd.data.xxx` in each tile iteration. `Lcd.data` returns `changetype<LcdGbData>(ptr)` — cheap but adds one pointer load per access. For tight loops, cache in locals.

### Uint32Array → raw store<u32>
AssemblyScript `TypedArray.__uset` has bounds-check overhead even inside `unchecked()`. Use:
```typescript
const ptr = typedArray.dataStart;
store<u32>(ptr + (index << 2), value);
```
Works for any typed array with known element size.

### StaticArray vs Uint32Array for Palette
`current32bitPalette` is `StaticArray<u32>` — `unchecked(palette[color])` compiles to direct memory read. Good. If it were `Uint32Array`, switch to `StaticArray` or use raw pointer.

---

## Remaining Hot Paths (post-optimization)

| Function | Self% | Notes |
|---|---|---|
| `ScanlineRenderer.Render` | ~17% | BG tile decode still per-pixel; tile cache would help |
| `Timer.Tick` | ~6.6% | Not renderer-related |
| `Cpu.executeNextInstruction` | ~6.3% | Not renderer-related |
| `Emulator.Tick` | ~3.8% | GetStopReason loop overhead |

**Next renderer win**: implement tile decode cache → eliminate `getColorIndexFromBytes` in BG decode path entirely.

---

## Key Files

| File | What to touch |
|---|---|
| `assembly/io/video/scanlineRenderer.ts` | Main render loop |
| `assembly/io/video/ppu.ts` | TickMultiple, getColorIndexFromBytes, enterMode |
| `assembly/io/video/lcd.ts` | Cached LCDC fields (TilesBaseAddress, etc.) |
| `assembly/io/video/oam.ts` | OamData struct layout |
| `assembly/emulator.ts` | Tick loop — DMA and PPU calls |

## Sources
- https://jsgroth.dev/blog/posts/gb-rewrite-pixel-fifo/
- https://medium.com/@torch2424/making-web-assembly-even-faster-debugging-web-assembly-performance-with-assemblyscript-and-a-4d30cb6463f1
- https://gbdev.io/pandocs/Rendering.html
- https://github.com/torch2424/wasmboy (AS GB emulator reference)
- https://surma.dev/things/js-to-asc/ (WASM optimization patterns)
