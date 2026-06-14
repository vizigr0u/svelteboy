# SvelteBoy — Play Chrome UX (YouTube player + flip mini-console)

Status: REVISED 2026-06-14. Rebuild of partially-built work (see "Already built"). Goal: remove/replace, not patch.

## Vision

Mobile-first. Two top-level states:

- **Library** (landing) — Hero (resume) → Continue row → Library grid. Pure: no top bar, no chrome.
- **Play** — canvas-pure. `game view` + virtual `pad`. Chrome = transient YouTube-style overlay. Settings = full-surface drawer; while open, the game layout becomes a **mini-console in the opposite orientation** (~⅓), keeping controls visible for live preview.

## Glossary

- **game view** — 160×144 GameBoy screen surface (WebGLCanvas).
- **pad** — on-screen virtual controls (dpad + A/B + Start/Select), coarse pointer only.
- **GameStage** — NEW component: game view + pad composed in a chosen arrangement. Props `layout: portrait|landscape` × `size: full|mini` × `interactive`. The keystone — one source for both full Play and mini-console.
- **chrome** — transient overlay (Pause/Library/Cog/title) over game view. White on black-50%.
- **drawer** — full-surface settings sheet, tabs General | Game.
- **mini-console** — GameStage at `size=mini`, opposite orientation, shown beside the open drawer.

## Locked decisions

1. **Settings = one drawer, two tabs** (General | Game). Cog → General. Bottom game-settings btn → Game.
2. **Two-stage tap.** First tap reveals chrome (auto-hide 3s). Center Big Pause toggles. Paused → chrome stays.
3. **Drawer keeps game running** (no pause). Live preview. *Flagged maybe-pause: load savestate/QuickLoad, battery RAM export — default no pause, verify no tear.*
4. **Chrome fully hidden** when idle (pure canvas). Discoverability = entry reveal-fade + onboarding only.
5. **Reveal-then-fade every Play entry** (3s); **first run sticky** (no fade until first interaction) + OnboardingCard.
6. **Drawer-open = flip mini-console** (coarse): drawer fills its region fully; game layout flips to opposite orientation at ~⅓ to keep controls visible. Game keeps running.
7. **Mini-console pad = interactive.** Tiny but live (same component).
8. **Transition full↔mini = snap / quick-fade.** Single WebGL canvas + pad reflow forbid clean morph (see T-notes). Morph deferred.
9. **Mini-console chrome = Pause only.** Library/Cog redundant (drawer present).
10. **Library = no Options entry.** Top bar removed. Settings reachable only in-Play (Cog). Pre-play config dropped — console feel.
11. **RomDrawer (details panel) removed.** Tap ROM = play. Per-ROM settings live only in in-Play Game tab.
12. **Desktop deferred** — no pad → mini-console degrades to screen-mini + full drawer; refine later.

## Already built (disk reality — edit/keep, don't re-create)

- `playUiStore.ts` — `chromeVisible`, `drawerOpen`, `drawerTab(general|game)`, `revealChrome/hideChrome/hideChromeSoon`, `markInteracted`, `togglePause`, `openDrawer/closeDrawer`, `registerFullscreenToggle/requestFullscreenToggle`, `CHROME_AUTOHIDE_MS`. **Keep, extend.**
- `Player.svelte` — composes WebGLCanvas + HudOverlay + PlayerChrome + LocalInputViewer; coarse/landscape detection; `drawer-open` class = **0.5 scale beside partial drawer** (the model being replaced). **Rewrite layout.**
- `PlayerChrome.svelte` — YouTube toolbar (Library→goToHome, Cog→drawer general, center Pause, bottom game-settings→drawer game). **Keep, verify.**
- `SettingsDrawer.svelte` — partial **50dvh bottom / 50vw left** + swipe-dismiss; tabs Game|General. **Rework to full-surface + flip orchestration.**
- `drawer/GeneralPane.svelte` (display/audio/controls/hud/system/advanced[gated]/about), `drawer/GamePane.svelte` (per-ROM: chips, reset, fullscreen, sub-tabs Saves|Settings|About reusing `RomDrawer/*`). **Keep.**
- `LocalInputViewer.svelte` — pad, modes `bar`(portrait) / `sides`(landscape). **`sides` uses `position: fixed` viewport overlay → must containerize (T1).**
- `OnboardingCard.svelte` + `onboardingStore.ts` — **keep.**
- `RomDrawer.svelte` + `RomDrawer/{PlayTab,SavesTab,SettingsTab,AboutTab,SaveSlotGrid,BatterySaveBanks}` — **delete RomDrawer + PlayTab; keep the rest (GamePane uses).**
- `HomeHub.svelte` — header (brand + palette-chip + gear→openDrawer). **Remove header.**
- `windowStores.selectedRomSha1` + App `#rom=` hash sync + App RomDrawer mount. **Retire.**

## Technical constraints (T-notes)

- **T1 — pad is `position: fixed`.** Landscape `sides` mode renders against viewport, not a container. Can't nest in a ⅓ mini-console. **Refactor to container-relative** (scoped container-query sizing) before mini works.
- **T2 — single WebGL canvas.** No two live game views → no true full+mini crossfade. Snap, or freeze a still during transition.
- **T3 — flip is reflow, not transform.** Pad moves bottom↔sides; not GPU-transformable. → snap/quick-fade only (decision 8).

## Target layouts

### Play (closed) — portrait
```text
┌─────────────┐
│  game view  │  full width, top
├─────────────┤
│ dpad  st A B│  pad bottom (bar)
└─────────────┘
```

### Play (closed) — landscape
```text
┌──────────────────────────┐
│ dpad │             │  B   │
│      │  game view   │  A  │  ← game view = 100% height, as big as possible
│ st   │  (centered)  │     │
│ sel  │             │      │
└──────────────────────────┘
```
- **Start/Select on LEFT, below dpad** (not bottom-center under game view).
- Left cluster = dpad (top) + Start/Select (below). Right cluster = B/A.
- Game view fills full available height, maximized; controls flank in side slack only.
- Current `sides` impl puts Start/Select bottom-center → **fix in P0**.

### Drawer open — device PORTRAIT → column (landscape mini on top)
```text
┌─────────────────────┐
│ dpad │ game │ B  ⏸  │  ← mini-console (landscape layout, ~⅓ H), Pause-only chrome
├─────────────────────┤
│      DRAWER          │  ← full surface, ~⅔ H × 100% W, opaque, top-aligned, scrolls
│  General | Game      │
└─────────────────────┘
```

### Drawer open — device LANDSCAPE → row (portrait mini on right)
```text
┌──────────────────────┬─────────┐
│   DRAWER (~⅔ W)       │  game ⏸ │  ← mini-console (portrait layout, ~⅓ W)
│   100% H, opaque      │ ─────── │
│   General | Game      │ dpadstAB│
└──────────────────────┴─────────┘
```

- Mini-console = GameStage opposite orientation, fits leftover strip's aspect. Enables live preview of palette/dpad/theme incl. controls.
- Drawer fills its whole region (opaque, no gap, no click-through); content top-aligns, scrolls on overflow.
- Mini % tunable (~⅓ game / ~⅔ drawer).
- Desktop (fine, no pad): mini = screen-only shrink; drawer full. Deferred.

## Phases (rebuild order)

### P0 — Containerize pad (T1)
Refactor `LocalInputViewer` `sides` mode off `position: fixed` → relative + container-scoped sizing, so it nests in any-size GameStage. Verify full landscape pad visually unchanged.

### P1 — `GameStage.svelte` (keystone)
Extract game view (WebGLCanvas + HudOverlay) + pad into one component. Props `layout` × `size` × `interactive`. Pad mode derives from `layout`; omitted when fine pointer. Renders full today; mini later. No behavior change at `size=full`.

### P2 — Rebuild Player around GameStage
Replace Player's inline composition + **delete 0.5-scale/beside-drawer logic**. Player renders `GameStage(full, device-orientation)` + PlayerChrome + SettingsDrawer. Keep fullscreen/wakelock/tap handlers.

### P3 — Drawer-open flip mini-console
When `drawerOpen && coarse`: switch to flip-split (portrait→column, landscape→row) with `GameStage(mini, opposite orientation, interactive)` + Pause-only chrome + full-surface drawer. Snap/quick-fade transition. Game keeps running. Desktop → screen-mini fallback.

### P4 — `SettingsDrawer` full-surface
Drop 50dvh/50vw. Drawer fills its split region opaque, content top-aligned + scroll. Tabs General|Game unchanged (GeneralPane/GamePane). Keep swipe/Esc/back close.

### P5 — Chrome spec verify/polish
Fully-hidden idle, reveal-fade **every** entry, first-run sticky + OnboardingCard, two-stage tap, center Pause, paused-stays. Reconcile against built PlayerChrome/playUiStore.

### P6 — Library cleanup
Remove HomeHub top bar. Tap ROM = play (resume-aware). ROM card context menu (long-press/right-click): Add to library (URI), Remove, Play from boot. Card shows last-played. **No Options entry.**

### P7 — RomDrawer removal
Delete `RomDrawer.svelte` + `RomDrawer/PlayTab.svelte`; unmount from App; retire `selectedRomSha1` + hash sync; `#rom=` → play directly. Keep `SavesTab/SettingsTab/AboutTab/SaveSlotGrid/BatterySaveBanks`.

### P8 — Back button + commands reconcile
Back: drawerOpen→close, playViewActive→Library, else leave. Verify `commands.ts` nav.* (openDrawer/goToHome). Remove palette-chip refs.

### P9 — Desktop refine (deferred)
Screen-mini drawer-open, command-palette visible trigger. Later.

## Reuse / Build / Rewrite / Delete

- **Reuse:** viewStore, playUiStore(extend), WebGLCanvas/PlayCanvas/HudOverlay, PlayerChrome, GeneralPane, GamePane, `RomDrawer/{SavesTab,SettingsTab,AboutTab,SaveSlotGrid,BatterySaveBanks}`, HomeHero/ContinuePlayingRow/RomsSection, OnboardingCard/onboardingStore, Toaster/Motd/AudioStatusNotice/ConfirmDialog, commands.ts.
- **Build:** `GameStage.svelte`.
- **Rewrite:** `Player.svelte` (layout), `SettingsDrawer.svelte` (full-surface + flip), `LocalInputViewer.svelte` (containerize), `HomeHub.svelte` (drop header).
- **Delete:** `RomDrawer.svelte`, `RomDrawer/PlayTab.svelte`, `selectedRomSha1` wiring + App hash sync + App RomDrawer mount, HomeHub header.

## Open / deferred

- Desktop refine (P9): mini fallback, palette trigger (Ctrl+K survives meanwhile).
- Morph transition (replace snap) — later, fights T2/T3.
- Mini %-split tuning (~⅓) — calibrate on device.
- ROM card context-menu interactions (long-press timing, fine right-click).
- Verify no-pause safe for QuickLoad / battery export (decision 3).

## Verify each phase

`pnpm check` (0 warn) · `pnpm test:web` · `pnpm exec vite build`.
