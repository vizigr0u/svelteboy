# Phase 4 — Command Palette (Cmd+K)

Surface power features without polluting casual UI. Single overlay, fuzzy search, keyboard-driven, palette-toggled flags persist to localStorage.

## Scope

- Global Cmd+K (or Ctrl+K) opens palette overlay
- Long-press app title (mobile) opens palette
- Sections: **Navigation**, **Playback**, **Saves**, **Speedrun** (always), **Debug** (only when `debugUnlocked`)
- Debug unlock paths: `?debug=1` query param OR 7-tap version chip OR explicit toggle in Options
- Palette state persists across views (App-level mount)
- Esc / backdrop click dismisses; arrow keys + Enter navigate

## Files

| File | Change |
|---|---|
| `src/lib/CommandPalette.svelte` (new) | overlay shell + search input + grouped list + key nav |
| `src/lib/commands.ts` (new) | command definitions, group enums, `runCommand(id)` dispatcher |
| `src/stores/paletteStore.ts` (new) | `paletteOpen`, `debugUnlocked` (IDB-persisted), `openPalette()`, `closePalette()` |
| `src/App.svelte` | mount `<CommandPalette />` globally; window-level Cmd+K listener |
| `src/lib/HomeHub.svelte`, `src/lib/Player.svelte` | replace burger items with palette opener + keep "Library/Back" essentials; show "⌘K" hint chip in top bar |
| `src/utils.ts` or new `src/queryParams.ts` | parse `?debug=1` on mount, set `debugUnlocked` |

## Command groups (initial set)

- **Navigation**: Back to library, Resume playing, Open ROMs library (focuses search), Open Options, Open Bindings, Open Saves, Open About
- **Playback**: Resume/Pause, Reset, Fullscreen, Mute/unmute audio
- **Saves**: Quick save slot 1/2/3, Quick load slot 1/2/3, Export current `.sav`, Import `.sav`
- **Speedrun**: Toggle frame counter HUD, Toggle input display HUD, Toggle CPU clock display, Frame-advance one frame, Toggle fast-forward
- **Debug** (gated): Open debug window, Attach/detach debugger, Toggle log filters, Step instruction, Dump hex range, Toggle PPU breaks

## Command shape

```ts
type Command = {
  id: string;              // 'play.resume', 'speedrun.frameAdvance'
  label: string;           // user-visible
  group: 'nav'|'play'|'saves'|'speedrun'|'debug';
  keywords?: string[];     // fuzzy match aliases
  shortcut?: string;       // display only, e.g. 'F'
  available: () => boolean;// hide when not applicable (e.g. saves need cart)
  run: () => void | Promise<void>;
};
```

## Implementation steps

1. **Store**: `paletteStore.ts` writable `paletteOpen`, IDB-persisted `debugUnlocked`. Helper `openPalette()` / `closePalette()` / `togglePalette()`.
2. **Commands registry**: static array of `Command` in `commands.ts`. Each has direct import of relevant emulator/lifecycle/store calls. Debug group filtered out via `available` when `!debugUnlocked`.
3. **Query param parser**: in App.svelte `onMount`, read `?debug=1` → set `debugUnlocked = true`. Strip param from URL via `history.replaceState`.
4. **Palette component**: fixed full-screen backdrop + centered 480px input + grouped list (Headless-UI-style). Fuzzy match via simple subsequence scoring (no fuse.js dep — small footprint). Arrow keys move highlight, Enter runs, Esc closes.
5. **Global keybinds**: `Cmd/Ctrl+K` → `togglePalette()`. Capture-phase listener on `window` to beat game input.
6. **Top-bar hint chip**: small `⌘K` pill in Player + HomeHub headers. On click → opens palette. Hides on mobile.
7. **Burger menu reduction**: strip menu down to {Library/Back, ⌘K hint, Fullscreen}. Move rest to palette.

## Visual

- Backdrop: `rgba(0,0,0,0.5)` + `backdrop-filter: blur(6px)`
- Container: 560px max-width, 8px radius, dark bg `#1a1a25`, top: 18vh
- Input: large 18px font, search icon left, kbd hint right
- Group headers: 11px uppercase muted
- Items: 13px, 36px tall, kbd shortcut right-aligned, hover/highlighted state via accent

## Acceptance criteria

- Cmd+K on any view opens palette
- Typing filters across groups; arrow keys + Enter work
- Resume / Pause command toggles `EmulatorPaused`
- Quick save slot 1 invokes `Emulator.QuickSave(1)`
- `?debug=1` on first load → debug commands appear; reload preserves
- Esc closes; backdrop click closes
- Palette suppressed when other modal open (RomDrawer / Window) to avoid stacking

## Out of scope (defer)

- Custom keybinding rebinder
- Recent commands / pinned shortcuts
- Command result toasts (palette closes after run; existing toaster handles errors)
- Fuse.js / heavy fuzzy lib — subsequence scorer enough for ~30 items

## Risk

- Cmd+K conflicts with browser address-bar focus on macOS Safari — acknowledge; provide alternative entry (top-bar chip).
- Game input might steal keystrokes — `capture: true` listener fires first, also stops propagation on K.
