# CSS Tokens & Refactor Plan

Aligned w/ `.claude/css-conventions.md`. Audit basis: 73 `.svelte` files.

## Decisions

- **Palette**: Catppuccin canonical. Existing dark vars repointed to Mocha, light to Latte. Two-palette drift collapses.
- **Light mode**: full Latte mapping symmetric w/ existing pattern.
- **Spacing / radii**: rem per conventions. No mass migration in P0 — em values stay until per-component touch.
- **Z-index**: only exact-match swaps in P0a (100/200/300). Off-scale (6/110/201) handled per-component in P0b.

---

## P0a — Tokens + exact-match swaps (safe) (done)

### Edit `src/app.css`

**Repoint existing dark tokens to Catppuccin Mocha** (drifts visuals on var consumers — expected):

```css
:root {
  /* dark = Catppuccin Mocha */
  --text-color: #cdd6f4;             /* was #FEFEFE */
  --text-faded-color: #a6adc8;       /* was #444 (subtext0) */
  --background-color: #1e1e2e;       /* was #242424 (base) */
  --section-bg-color: #181825;       /* was #1f1f1f (mantle) */
  --subsection-bg-color: #313244;    /* was #222 (surface0) */
  --highlight-color: #89b4fa;        /* was #5483c1 (blue) */
  --button-background-color: #45475a;/* was #323455 (surface1) */
}
```

**Add new tokens** (additive, zero risk):

```css
:root {
  /* colors */
  --panel-color: #313244;
  --border-color: #45475a;
  --muted-color: #a6adc8;
  --danger-color: #f38ba8;
  --success-color: #a6e3a1;
  --warning-color: #f9e2af;

  /* overlays */
  --scrim: rgba(0, 0, 0, 0.5);
  --tint-1: rgba(255, 255, 255, 0.05);
  --tint-2: rgba(255, 255, 255, 0.08);
  --tint-3: rgba(255, 255, 255, 0.12);

  /* z (per conventions) */
  --z-base: 0;
  --z-content: 10;
  --z-hud: 100;
  --z-overlay: 200;
  --z-modal: 300;
  --z-toast: 400;

  /* spacing (per conventions, 4px geo) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;

  /* radii */
  --radius-sm: 2px;
  --radius-md: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-pill: 9999px;

  /* motion */
  --ease-out: cubic-bezier(0.2, 0.8, 0.3, 1);
  --t-fast: 0.12s;
  --t-base: 0.18s;
  --t-slow: 0.22s;

  /* elevation */
  --elev-1: 0 2px 6px rgba(0, 0, 0, 0.3);
  --elev-2: 0 4px 16px rgba(0, 0, 0, 0.5);
  --elev-3: 0 8px 32px rgba(0, 0, 0, 0.6);
}
```

**Light = Catppuccin Latte**:

```css
@media (prefers-color-scheme: light) {
  :root {
    --text-color: #4c4f69;
    --text-faded-color: #6c6f85;
    --background-color: #eff1f5;
    --section-bg-color: #e6e9ef;
    --subsection-bg-color: #ccd0da;
    --highlight-color: #1e66f5;
    --button-background-color: #ccd0da;

    --panel-color: #ccd0da;
    --border-color: #bcc0cc;
    --muted-color: #6c6f85;
    --danger-color: #d20f39;
    --success-color: #40a02b;
    --warning-color: #df8e1d;

    /* flip white tints to black on light surfaces */
    --tint-1: rgba(0, 0, 0, 0.05);
    --tint-2: rgba(0, 0, 0, 0.08);
    --tint-3: rgba(0, 0, 0, 0.12);
    /* --scrim stays black */
  }
}
```

### Safe sweeps across components (literal → var only on exact value match)

| Find | Replace |
|---|---|
| `#1e1e2e` | `var(--background-color)` |
| `#cdd6f4` | `var(--text-color)` |
| `#89b4fa` | `var(--highlight-color)` |
| `#313244` | `var(--panel-color)` |
| `#45475a` | `var(--border-color)` |
| `#f38ba8` | `var(--danger-color)` |
| `#a6e3a1` | `var(--success-color)` |
| `rgba(0,0,0,0.5)` | `var(--scrim)` |
| `rgba(255,255,255,0.05)` | `var(--tint-1)` |
| `rgba(255,255,255,0.08)` | `var(--tint-2)` |
| `rgba(255,255,255,0.12)` | `var(--tint-3)` |
| `z-index: 100` | `var(--z-hud)` |
| `z-index: 200` | `var(--z-overlay)` |
| `z-index: 300` | `var(--z-modal)` |

**Excluded from P0a** (P0b or skip): `#FEFEFE`, `#888`, `#fff`/`white`, off-scale rgba (0.06/0.1/0.3/0.4/0.6/0.75), z 6/110/201, all spacing, all radii, all font-size, em→rem.

**Deliverable**: 1 PR. `app.css` repoint + add + mechanical sweep. Manual scan post-sweep for false positives (comments, script blocks).

### Pre-impl checks

- Grep `#1e1e2e` / `#cdd6f4` / `#89b4fa` outside `<style>` blocks (false-positive risk).
- Spot-check Player, debug panels, dialogs after palette repoint.
- Toggle `prefers-color-scheme: light` to validate Latte.

---

## P0b — Trickier swaps (per-component judgment) (done)

1. **`#FEFEFE` → `var(--text-color)`** (12 files) — now `#cdd6f4`. Visual diff intentional.
2. **`#888` → `var(--muted-color)`** (24 files) — now `#a6adc8`. Defer if pixel-perfect HUD.
3. **`#fff`/`white` literals** — keep on HUD/pixel-perfect; else swap.
4. **Off-scale tints (0.06, 0.1, 0.3, 0.4, 0.6, 0.75)** — round to nearest `--tint-*` OR keep literal w/ rationale comment.
5. **z-index 6 / 110 / 201** — pick layer: 6→`--z-content`, 110→stay `--z-hud`, 201→stay `--z-overlay`. Verify stacking neighbors before bump.
6. **Border greys (#333/#444/#555/#666/#111)** — collapse to `--border-color` and/or new `--surface-deep` token. Each component decides intent.
7. **Off-scale shadows** — map to `--elev-*` (accept change) OR keep one-off w/ comment.

**Deliverable**: 1 PR per high-impact file. Combine w/ P1 button migration when same file.

---

## P1 — Button utilities (in `app.css`) (done)

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 2.75rem;            /* tap target */
  padding-inline: var(--space-4);
  border-radius: var(--radius-md);
  font: inherit;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.btn-primary   { background: var(--highlight-color); color: var(--background-color); border: 1px solid transparent; }
.btn-secondary { background: var(--panel-color); color: var(--text-color); border: 1px solid var(--border-color); }
.btn-danger    { background: transparent; color: var(--danger-color); border: 1px solid var(--border-color); }
.btn-ghost     { background: transparent; color: var(--text-color); border: 1px solid transparent; }
.btn-icon      { padding-inline: var(--space-2); min-width: 2.75rem; }
.btn:hover     { border-color: var(--highlight-color); }
.btn:focus-visible { outline: 2px solid var(--highlight-color); outline-offset: 2px; }
```

Migrate consumers: `ConfirmDialog.svelte`, `RomDrawer.svelte`, `PlaySheet.svelte`, `RomsSection.svelte`, `debug/DebugSection.svelte`, `RomDrawer/PlayTab.svelte`. One PR per cluster.

---

## P2 — Modal/overlay primitives (done)

`Window.svelte` = component-level modal abstraction (was raw `z-index:99` + literal `rgba(0,0,0,0.3)`). Consumers outside it rolled own backdrop+shell w/ drifting scrim bg (0.3/0.4/0.45/0.5).

Added `.scrim` + `.modal-shell` to `app.css`. Migrated (`class="<util> <local>"`, local = position/sizing/anim only):

- `ConfirmDialog` — `scrim` + `modal-shell` (clean centered modal).
- `Window.svelte` — `scrim` + `modal-shell`; window bumped to `--z-modal` so it sits above scrim, fixed raw `z:99` + literal bg.
- `PlaySheet` `.sheet-backdrop` — `scrim` only (keeps fade anim). Sheet shell stays custom (bottom radius + upward shadow ≠ modal-shell).
- `RomDrawer` `.rom-drawer-backdrop` — `scrim` only (keeps right-align flex). Drawer shell stays custom (border-left, no radius, slide-in ≠ modal-shell).

Scrim bg unified to `var(--scrim)` (0.5) across all 4 — slight darkening on drawer/sheet/window, intentional consistency.

Utilities added to `app.css`:

```css
.scrim {
  position: fixed; inset: 0;
  background: var(--scrim);
  z-index: var(--z-overlay);
}
.modal-shell {
  position: fixed;
  z-index: var(--z-modal);
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--elev-3);
}
```

---

## P3 — `.panel` utility (done)

```css
.panel {
  background: var(--panel-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
```

Added to `app.css`. Scope = standalone cards only (not `debug-tool-container` family — that global already acts as panel across 14 files; defer to broader sweep).

Migrated (`class="panel <local>"`, local rule keeps distinct bg + tighter padding, panel supplies tokenized border+radius):

- `BatterySaveBanks.svelte` `.banks-card` — bg `#181825` → `var(--section-bg-color)`
- `CheatsPanel.svelte` `.collections-panel` — kept faint tint bg

Deferred: `RomList` / `DebugSection` panels live inside `debug-tool-container`; unify when that family migrated.

---

## P4 — Popover primitive (hold)

Rule of three not met (only `PalettePicker`, `DebugSection`). Add `.popover` utility now, defer `Popover.svelte` extraction until 3rd consumer.

```css
.popover {
  position: absolute;
  top: calc(100% + 4px);
  z-index: var(--z-overlay);
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--elev-2);
}
```

---

## P5 — Chips / badges (deferred)

**Blocked**: two existing scoped `.chip` defs diverge — `HomeHero` metadata badge (tint bg, 0.25em radius, non-interactive) vs `RomsSection` filter-pill button (panel bg, pill radius, `.active` state, pointer). Same class name, different shape. A global `.chip` in `app.css` would cascade onto both → collision. Not a clean rule-of-three. Revisit if a 3rd, consistent chip shape appears; otherwise rename per-component first.

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.05em 0.4em;            /* em on purpose: type-relative */
  border-radius: var(--radius-sm);
  font-size: 0.75em;                 /* type-relative; tokenize later */
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--tint-2);
  color: var(--text-color);
}
```

HUD chips stay pixel-perfect per conventions. Keep `px`. Comment: `/* pixel-perfect HUD — see .claude/css-conventions.md */`.

---

## P6 — Tabs / segmented control

**Skip**. 1 consumer (`RomDrawer`). Re-evaluate at 3rd.

---

## P7 — Global `@keyframes` + motion vars (done)

Move `slideIn`, `slideUp`, `fadeIn`, `skeleton-shimmer`, `icon-spin` to `app.css`. Standardize entrance anims on `var(--t-base) var(--ease-out)`. Bundle w/ P0a if scope OK.

---

## P8 — Type scale (deferred)

Conventions: body fixed rem. em→rem conversion per-component when file touched. No global `--text-*` tokens until pattern proven. `h1`–`h3` `clamp()` fluid (already specced).

---

## P9 — Mobile-first breakpoint flip (per-component) (in progress)

```css
/* before */
@media (max-width: 600px) { .rom-drawer { width: 100vw; } }

/* after */
.rom-drawer { width: 100vw; }
@media (min-width: 640px) { .rom-drawer { width: 24rem; } }
```

Use literal `640px` / `1024px` per conventions (vars don't work in `@media`).

Flipped (touched in P2, `max-width:600px` → mobile-first `min-width:640px`):

- `RomDrawer.svelte` — base full-width drawer, 480px from sm.
- `Window.svelte` — base fullscreen sheet, centered floating modal from sm.

Remaining `max-width:600px`: `HomeHero.svelte` — flip when next touched.

---

## Execution order

1. ✅ **P0a** — `app.css` tokens + light mode + safe sweeps. 1 PR. Visual drift accepted.
2. ✅ **P7** — global keyframes + motion vars. Bundle w/ P0a if scope OK.
3. ✅ **P0b** — high-impact files (RomDrawer, DebugSection, ConfirmDialog, PalettePicker, HudOverlay). 1 PR each. Mix in P1 button migration when same file.
4. ✅ **P1** + ✅ **P3** — utility classes added in app.css w/ P0a; consumers migrated as part of P0b / opportunistic touches. (P3 = standalone cards only; debug-tool-container family deferred.)
5. ✅ **P2** — scrim + modal-shell utilities; ConfirmDialog/Window full, PlaySheet/RomDrawer scrim-only.
6. ⏸️ **P5** — deferred: `.chip` name collides w/ 2 divergent scoped defs.
7. 🔄 **P9** — flipped RomDrawer + Window (P2-touched); HomeHero pending touch.
8. **P4 / P6 / P8** — defer until 3rd consumer or stable pattern.

---

## Audit findings recap (basis for plan)

Top-duplicated literals across 73 files:

- Colors: `#cdd6f4` ×30, `#89b4fa` ×30, `#1e1e2e` ×26, `#888` ×24, `#45475a` ×23, `#313244` ×14, `#f38ba8` ×9, `#a6e3a1` ×3
- Tints: `rgba(255,255,255,0.06)` ×8, `rgba(255,255,255,0.08)` ×7, `rgba(0,0,0,0.5)` ×6, `rgba(255,255,255,0.05)` ×6, `rgba(255,255,255,0.1)` ×5, `rgba(255,255,255,0.12)` ×5
- Gaps (em): `0.3em` ×21, `0.4em` ×15, `0.5em` ×14, `0.6em` ×14, `1em` ×11
- Radii: `0.3em` ×13, `4px` ×11, `3px` ×10, `2px` ×8, `0.2em` ×8, `999px` ×5
- Font-size (em): `0.85em` ×38, `0.9em` ×32, `1.1em` ×12, `0.75em` ×10, `0.8em` ×8
- Z-index spread: 6, 100, 110, 200, 201, 300

Highest-CSS-volume files: `RomDrawer.svelte` (320 lines), `debug/DebugSection.svelte`, `ConfirmDialog.svelte`, `PalettePicker.svelte`, `hud/HudOverlay.svelte`.
