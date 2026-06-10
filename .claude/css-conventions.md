# CSS Conventions

SvelteBoy style rules. `.svelte <style>` + `src/app.css`. Goal: consistent, responsive (desktop big/small + mobile).

## TL;DR

- 🎯 **Tokens > literals.** Color/space/z/bp = CSS vars in `app.css`. Literal only if no token fits + truly one-off.
- 📏 `rem` = spacing, sizing, most font-size. Base `16px`, never override `html { font-size }`.
- 🔗 `em` = type-relative only (padding inside heading button).
- 🔬 `px` = pixel-perfect (HUD, debug chips, 1–2px borders, `9px`/`11px` chip text). Comment when non-obvious.
- 📱 **Mobile-first.** Base = mobile. `min-width` MQ adds desktop.
- 🚦 Breakpoints: `sm`=640px, `lg`=1024px. Two enough.
- 🅰️ `h1`–`h3` = `clamp()` fluid. Body = fixed `rem`.
- 👆 Tap targets ≥ **44×44px** on `pointer: coarse`.
- 📦 Container queries → resizable parents (Player, panels). MQ → page layout.
- 📐 Full-height = `dvh` + `vh` fallback via `@supports`.

## Token-first rule

Biggest drift cause = hex/px/z scattered per component. Each looks fine alone → together unthemeable.

**Before writing literal: check `app.css` for token.** Fits → use. None fits + value recurs → add token. True one-off → literal OK (rare).

| Don't | Do |
|---|---|
| `color: #5483c1` | `var(--highlight-color)` |
| `background: #222` | `var(--subsection-bg-color)` |
| `padding: 12px` | `var(--space-3)` |
| `margin-bottom: 1rem` | `margin-block-end: var(--space-4)` |
| `z-index: 100` | `var(--z-hud)` |
| `@media (max-width: 600px)` | `@media (min-width: 640px)` |
| hardcoded font-family | inherit `:root` |

Literal OK:

- `1px`/`2px` borders
- HUD (pixel-perfect section)
- Single-use color w/ no semantic meaning (still prefer token if might recur)

## Unit decision table

| Use | Unit | Notes |
|---|---|---|
| Spacing (margin/padding/gap) | `rem` via `--space-*` | |
| Component width/max-width | `rem` | `max-width: 30rem` etc |
| Body / paragraph | `rem` | fixed at breakpoints |
| `h1`–`h3` | `clamp(min, vw, max)` | see Fluid type |
| Type-relative spacing | `em` | icon↔label in button |
| Borders/hairlines | `px` | sub-pixel rounding |
| HUD/debug | `px` | crisp small text |
| Full viewport | `dvh`/`dvw` + `vh`/`vw` fallback | |
| Inside CQ parent | `cqmin`/`cqi`/`%` | scale w/ container |
| Grid tracks | `fr`, `minmax()` + `rem` min | |
| Z-index | `--z-*` | no raw int |

## Tokens (`:root` in `app.css`)

Components → `var(--token)`. ⚠️ **No orphan tokens.** Add when first consumer needs it.

### Spacing — 4px geometric

```css
--space-1: 0.25rem;  /* 4px  */
--space-2: 0.5rem;   /* 8px  */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.5rem;   /* 24px */
--space-6: 2rem;     /* 32px */
--space-7: 3rem;     /* 48px */
--space-8: 4rem;     /* 64px */
```

Pick closest. Between → smaller. Genuine intermediate → literal `rem`, not new token.

### Breakpoints

```css
--bp-sm: 640px;
--bp-lg: 1024px;
```

CSS vars don't work in `@media` → use literal, keep in sync w/ comment.

### Z-index layers

```css
--z-base:    0;
--z-content: 10;
--z-hud:    100;
--z-overlay:200;
--z-modal:  300;
--z-toast:  400;
```

Kills current 5–401 spread. Components pick layer, never raw int.

### Colors (already in `app.css`)

```css
--text-color, --text-faded-color, --highlight-color,
--background-color, --section-bg-color,
--subsection-bg-color, --button-background-color
```

Auto-switched by `prefers-color-scheme: light`. **New hex in component = wrong.** Need new color → add token + map both schemes.

## MQ (mobile-first)

```css
.container { padding: var(--space-3); }

@media (min-width: 640px) {
  .container { padding: var(--space-4); }
}

@media (min-width: 1024px) {
  .container { padding: var(--space-6); }
}
```

- Default = mobile.
- `min-width` adds desktop.
- `max-width` rare (only "below X only").
- Keep `prefers-color-scheme`, `(pointer: coarse)`.

## Fluid type (headings only)

```css
h1 { font-size: clamp(1.75rem, 1.25rem + 2vw, 3rem); }
h2 { font-size: clamp(1.5rem,  1.1rem  + 1.5vw, 2.25rem); }
h3 { font-size: clamp(1.125rem, 1rem + 0.5vw, 1.5rem); }
```

Body/labels/buttons = fixed `rem`. Predictable rhythm.

## Tap targets

Interactive (button, link, toggle, joypad hit-area) ≥ **44×44px** on coarse pointer.

```css
.button { min-height: 2.75rem; min-width: 2.75rem; }

@media (pointer: coarse) {
  .icon-button { min-height: 2.75rem; min-width: 2.75rem; }
}
```

Desktop-only (debug chips) exempt → hidden on mobile or behind panel.

## Container queries

Use when:

- Component in resizable parent (Player canvas area, panels, modals).
- Reflow on own width, not viewport.

Example: `PlaySheet.svelte` `cqmin` for game controls. Keep pattern.

MQ when:

- Page-level layout (sidebar collapse, 2col→1col).
- Always full-width.

## Viewport height

Mobile URL bar changes visible viewport. `dvh` = current actual. `vh` = max (clips when bar visible).

```css
.fullscreen {
  height: 100vh;     /* fallback */
  height: 100dvh;    /* modern */
}
```

Or:

```css
@supports (height: 100dvh) {
  .fullscreen { height: 100dvh; }
}
```

`svh` only if always-small framing wanted (rare here). `lvh` rarely useful.

## Safe-area insets

Already in `PlaySheet.svelte`:

```css
padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
```

Use `env(safe-area-inset-*)` for UI flush w/ screen edge on mobile.

## Pixel-perfect exception (HUD/debug)

`HudOverlay.svelte` + debug panels use raw `px` font-size/spacing. **Intentional, keep.**

- `9px`/`11px` text crisp at smallest legible size.
- `1px`/`2px` borders avoid sub-pixel artifacts.
- Debug = dev-facing → consistent render > scaling.

New pixel-perfect UI → comment: `/* pixel-perfect HUD — see .claude/css-conventions.md */`.

## Don't

- ❌ Raw `px` for spacing → token or `rem`.
- ❌ `em` cascades for layout → compounds nested.
- ❌ Bare int z-index → `--z-*`.
- ❌ Bare hex color → token.
- ❌ New breakpoints w/o consensus. Two cover project.
- ❌ Default `max-width` MQ → only if "below X" is real intent.
- ❌ Override `html { font-size }` unless rebaselining whole app.

## Migration

Incremental. **No mega-PR refactor.** Touch component for other reason →

1. `em` → `rem` for layout/spacing. Keep `em` only type-relative.
2. Raw `px` spacing → nearest `--space-*`.
3. Raw int z-index → `--z-*`.
4. Hex color → existing token (or add token if missing).
5. Component MQ → flip to mobile-first `min-width` if practical.

HUD + debug panels = out of scope.

## Quick reference

```css
/* Mobile-first card */
.card {
  padding: var(--space-3);
  margin-block-end: var(--space-4);
  border-radius: 0.5rem;
  background: var(--subsection-bg-color);
  color: var(--text-color);
  z-index: var(--z-content);
}

@media (min-width: 640px) {
  .card { padding: var(--space-4); }
}

@media (min-width: 1024px) {
  .card { padding: var(--space-5); }
}

/* Tap-friendly button */
.button {
  min-height: 2.75rem;
  padding-inline: var(--space-4);
  font-size: 1rem;
  background: var(--button-background-color);
  color: var(--text-color);
}

/* Fluid heading */
.title {
  font-size: clamp(1.75rem, 1.25rem + 2vw, 3rem);
}
```
