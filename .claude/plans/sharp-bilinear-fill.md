# Sharp-Bilinear Fill — Plan

## Goal

Game view fills its wrapper (full W or full H, aspect-locked) by default. No
integer-snap slack, no bilinear blur. The uneven-pixel problem is solved in the
shader, not by snapping the display size.

## Why blur happens now

Two-stage scale in [WebGLCanvas.svelte](../../src/lib/WebGLCanvas.svelte):

1. Composite shader uses `texelFetch` (nearest) into a canvas backing buffer
   fixed at `480×432` (`RENDER_SCALE=3`, lines 260-261).
2. CSS scales `480×432` → display size. Non-integer CSS step +
   `image-rendering: auto` (line 369) = bilinear blur.

The blur lives in step 2. Fix: kill CSS scaling (make backing == display px),
and do the upscale in step 1 with a filter that stays sharp at any scale.

## Approach

**Sharp-bilinear** (pixel-art antialiasing): sample the source per-texel but
antialias only across texel boundaries, over the fractional screen pixel. Each
GB pixel renders uniform; edges get sub-pixel coverage instead of snapping to
3px / 4px widths. Crisp, and fills any size.

## Steps

### 1. Backing buffer = display size

`recomputeDisplaySize()` (lines 199-223):

- **pixelPerfect OFF** (new default behavior): `cssW/cssH` = aspect-fit of
  wrapper (already computed in the else-branch). Set
  `canvas.width = round(cssW * dpr)`, `canvas.height = round(cssH * dpr)`, and
  matching `canvas.style.width/height`.
- **pixelPerfect ON**: keep current integer-snap path unchanged (purist mode).
- `dpr = window.devicePixelRatio`; re-run on `resize` / `fullscreenchange`
  (observers already wired).
- Drop the fixed `canvas.width = W * RENDER_SCALE` (lines 260-261) — now dynamic.

### 2. Composite shader sharp-bilinear

`compositeFragSrc` (lines 101-138):

- Add a helper sampling `uCurr`/`uPrev` over normalized `fUV` (source 160×144):

```glsl
vec3 sharpSample(sampler2D t, vec2 uv, vec2 size) {
  vec2 p = uv * size - 0.5;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 w = fwidth(p);                                    // screen-space texel footprint
  f = clamp((f - 0.5) / max(w, 1e-4) + 0.5, 0.0, 1.0);  // AA only at edges
  vec2 suv = (i + 0.5 + f) / size;
  return texture(t, suv).rgb;
}
```

- Replace `texelFetch(uCurr,...)` / `texelFetch(uPrev,...)` with `sharpSample(...)`.
- FBO textures (`texCurr/texPrev`) are currently `NEAREST` → switch to `LINEAR`
  in `makeRgbaFbo` (lines 182-197); sharp-bilinear needs the hardware lerp.
  Pass A is unaffected (writes full-texel).

### 3. CGB subpixel mode interaction

[cgbSubpixel.ts](../../src/lib/shaders/cgbSubpixel.ts) draws an RGB stripe
pattern keyed to source size. At large fill scale the stripes widen — verify it
still reads as subpixel rather than visible bands. May need to gate subpixel to
a minimum effective scale, or scale the pattern by output px. Check visually.

### 4. PixelPerfect option semantics

- Keep the store ([optionsStore.ts:52](../../src/stores/optionsStore.ts#L52)).
  Re-label in Settings: ON = integer-snap (crisp, may letterbox), OFF (new
  default) = fill + sharp-bilinear.
- Flip default to `false`.

### 5. Screenshot path

`registerShadedCanvas` ([GameStage.svelte:91](../../src/lib/GameStage.svelte#L91))
/ [screenshot.ts](../../src/screenshot.ts) reads the canvas backing. Backing is
now display-size, not `480×432` — verify `ScreenshotSize='canvas'` output is
sane; `'gb'` mode (160×144) is likely separate. Test both.

### 6. Perf

Composite now runs at full display res (e.g. 1440×1296 vs 480×432) every frame.
`texture()` + `fwidth` are cheap; fragment count up ~9×, trivial for one
fullscreen quad. Verify on low-end hardware.

## Test

- Visual screenshot (real Chromium, `frontend-visual-test-wsl` recipe) at window
  sizes that force non-integer scale (e.g. 700px tall). Confirm crisp uniform
  pixels, no blur, no shimmer on scroll.
- DMG + CGB ROM, ghosting on/off, fullscreen, dpr=1 and dpr=2.
- PixelPerfect toggle in both states.

## Files

- [WebGLCanvas.svelte](../../src/lib/WebGLCanvas.svelte) — main change
- [optionsStore.ts](../../src/stores/optionsStore.ts) — flip default
- Settings UI — relabel toggle
- [cgbSubpixel.ts](../../src/lib/shaders/cgbSubpixel.ts) — maybe, if stripes band
