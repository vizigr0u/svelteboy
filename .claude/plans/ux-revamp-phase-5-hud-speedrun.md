# Phase 5 — HUD chips + speedrun tools

Always-on heads-up display for speedrunners + casuals who want at-a-glance state. Lightweight, palette-toggleable, persists to localStorage. Plus speedrun-grade savestate slots and frame-advance.

## Scope

- **HUD chip system**: corner-anchored translucent chips, individually toggleable
- Chips: FPS, frame counter, input display, CPU cycle counter, rewind buffer indicator
- **Savestate slot panel** in PlaySheet (mobile) and as new floating mini-panel (desktop, optional)
- **Frame-advance** + **fast-forward** controls accessible via palette + keybind
- **Input display** widget reuses LocalInputViewer styling (mini)
- Chip positions: TL / TR / BL / BR — user-configurable, default TR
- Speedrun mode = bundle that toggles FPS + frame counter + input display together

## Files

| File | Change |
|---|---|
| `src/lib/hud/HudOverlay.svelte` (new) | mounts inside `.play-stage`, renders enabled chips, positions them |
| `src/lib/hud/FpsChip.svelte` (new) | thin wrapper around existing FPSCounter logic, restyled as chip |
| `src/lib/hud/FrameCounterChip.svelte` (new) | reads `cycleCount` / `currentFrame` from debugInfo |
| `src/lib/hud/InputDisplayChip.svelte` (new) | mini D-pad + buttons reflecting `KeyPressMap` |
| `src/lib/hud/RewindChip.svelte` (new, optional) | shows buffer fullness if rewind active |
| `src/stores/hudStore.ts` (new) | IDB-persisted `hudEnabled` map + `hudPosition`, helpers |
| `src/lib/SaveSlotPanel.svelte` (new) | reusable 1-9 slot grid w/ thumbnails (extracted from SaveSlotGrid?) |
| `src/lib/PlaySheet.svelte` | replace single Quick save/load entries with slot panel disclosure |
| `src/emulator/saveState.ts` | add named export `quickAdvanceOneFrame()` |
| `src/emulator/index.ts` | expose `Emulator.FrameAdvance`, `Emulator.SetSpeed(multiplier)` |
| `src/emulator/loop.ts` | implement fast-forward via speed multiplier in runEmulator timing |
| `src/inputs.ts` | new keybinds: `.` frame-advance, `Tab` fast-forward hold, F1-F9 save, Shift+F1-F9 load |
| `src/lib/commands.ts` | register speedrun + HUD toggle commands |
| `src/lib/Player.svelte` | mount `<HudOverlay />` inside play-stage; remove inline FpsCounter (chip handles) |

## HUD chip pattern

```ts
type HudChipId = 'fps' | 'frame' | 'input' | 'cpu' | 'rewind';
type HudConfig = {
  enabled: Record<HudChipId, boolean>;
  position: 'tl' | 'tr' | 'bl' | 'br';   // global, applies to all enabled
};
```

Each chip: 24-32px tall, monospace font, 60% black bg, 80% white text, 4px radius, gap 4px. Stack vertically.

## Savestate slot panel

- 9 slots, 3×3 grid, each shows thumbnail (already captured via `saveState.ts`) or `+` placeholder
- Tap empty → save into slot; tap filled → load; long-press / hold-shift → menu (overwrite/delete/export)
- Uses existing `saveSlot` / `loadSlot` from `src/saveStateDb.ts`
- Mounted in PlaySheet under "Save states" disclosure; optional floating mini-panel desktop (toggle via palette)

## Implementation steps

1. **`hudStore.ts`**: IDB-persisted writable. Defaults: `{ enabled: { fps: false, frame: false, input: false, cpu: false, rewind: false }, position: 'tr' }`. Helper `toggleHudChip(id)`.
2. **`HudOverlay.svelte`**: subscribe to hud store; absolute-positioned container inside `.play-stage` corner; renders each enabled chip.
3. **Chip components**: each 1-purpose. `FpsChip` derives from existing `FrameStats` already shared. `FrameCounterChip` derives `currentFrame` from `getDebugInfo` (already polled when debug attached; otherwise read directly via lightweight call — add export `getCurrentFrame(): u32` to backend if not present, or use cycle counter divided).
4. **Input display chip**: subscribe to `KeyPressMap`, render 8 micro-buttons (D-pad + Start/Select + B/A) flat layout, ~80×30px.
5. **Player.svelte**: replace `{#if $showFPS}<FpsCounter />` block with `<HudOverlay />`. Migrate `showFPS` / `showFrametimeHistogram` toggles to hudStore.
6. **Frame-advance**: in `emulator/index.ts` expose `FrameAdvance: requestRunOneFrame` (already exists for debug). Map keybind `.` (when paused).
7. **Fast-forward**: extend `runEmulator` call site in `loop.ts` to multiply deltaTime by `EmulatorSpeed` store value (already a store at `src/stores/playStores.ts`? — verify; if not, add to optionsStore). Bind `Tab` keydown → set 4x, keyup → 1x.
8. **Save slot panel**: extract or refactor existing `SaveSlotGrid.svelte` so PlaySheet can embed it; add 9-slot view if currently fewer.
9. **Commands**: register `speedrun.toggleFps`, `speedrun.toggleFrameCounter`, `speedrun.toggleInputDisplay`, `speedrun.frameAdvance`, `speedrun.toggleFastForward`, `speedrun.enableAll`.
10. **Speedrun bundle**: single command that flips `fps + frame + input` enabled-true at once (palette: "Enable speedrun HUD").

## Acceptance criteria

- Toggle each chip via palette → appears/disappears in corner
- Position change in Options → all chips reposition
- FPS chip shows live frame rate without affecting perf (no extra postRun work beyond existing counter)
- Frame counter increments per frame visibly
- Input display flashes buttons in sync with keyboard / touch input
- Tab held → fast-forward audio + video; release → normal speed
- `.` (period) when paused → advance exactly one frame
- F2 / Shift+F2 → quicksave/quickload slot 2
- HUD prefs persist across reload
- "Enable speedrun HUD" palette command flips all three at once

## Out of scope

- Rewind buffer impl (chip stays gated until rewind feature lands)
- TAS movie file recording/playback
- Splits/timer integration (livesplit-style)
- RetroAchievements
- Custom chip positions per-chip (single global position only v1)

## Risk

- Frame counter read path: adding per-frame getter call could be slow; bind to existing `postRun` debug snapshot pipeline only when chip enabled.
- Fast-forward audio: existing audio queue may glitch at high multipliers; cap at 4x; mute if user wants speed > 4x.
- Input display chip rendering during input flurries could thrash DOM; throttle to 30Hz update.

## Dependencies / sequencing

- Phase 4 (palette) lands first — provides toggle UI for HUD chips and speedrun commands.
- Existing `SaveSlotGrid.svelte` review before extract (may already meet needs).
- `EmulatorSpeed` confirm if exists; add to optionsStore if not.
