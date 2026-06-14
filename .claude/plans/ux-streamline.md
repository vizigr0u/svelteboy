# UX Streamline Plan

Status: LOCKED 2026-06-11
Supersedes: ad-hoc burger + RomDrawer + PlaySheet model

## Problem

Current chrome is fragmented:
- Burger menu = junk drawer (2-3 items), Options missing
- RomDrawer (rich info) unreachable during Play
- PlaySheet (rich actions) mobile-only; desktop burger is impoverished
- Resume pill, palette chip, burger, drawer, sheet = 5 overlapping surfaces
- "Back" button on Play implies hierarchy that doesn't match user mental model
  (Play is primary state, Library is secondary browse)

## Design pillars

1. **Play = primary state.** No persistent chrome over canvas.
2. **One overlay surface.** All actions, info, settings reachable from one combo menu.
3. **Library = landing route.** Netflix-like browse, even for returning users.
4. **Palette = power search.** Untouched. `⌘K` / `Ctrl+K`.
5. **Discoverability ≥ minimalism.** Onboarding card + desktop rail mitigate hidden-gesture risk.

## Surfaces (final)

### HomeHub (route `/`)
Landing page. Always shown on cold load (returning + first-time).
- Topbar: brand + `⌕ ⌘K` palette chip (desktop) + `⚙` gear
- Hero card (last played, big Resume button)
- Recently played rail
- Library rail
- Homebrew rail
- Drop zone
- No burger. No resume pill (hero handles it).

### Play (state, not route)
Pure canvas. Triggered by Play/Resume from HomeHub or deeplink.
- Transient title strip top, mid-alpha bg, fades after ~1s
- Title strip returns on overlay-close, mouse-move (desktop), tap (mobile single-tap)
- Desktop left rail: 2 icons (📚 Library, ⚙ Options). Visible 3s on session entry, then auto-hide.
  - Hot-zone 8px left edge re-shows on cursor approach
- Mobile: nothing visible. Single-tap canvas opens overlay.
- Double-tap canvas = fullscreen (current behavior preserved)
- Drop ROM = switch game (auto-snap old session). Drop-affordance hidden on `pointer: coarse`.

### Combo Overlay
Single component, replaces RomDrawer + PlaySheet + Saves/Options/Bindings/About windows.
- Auto-pauses emulator on open. Resumes on close.
- Center-presented on desktop (large modal), bottom-sheet on mobile.
- Triggers:
  - Desktop: `Esc`, rail icon click
  - Mobile: single-tap canvas
- Close:
  - Desktop: `Esc`, close button, click backdrop
  - Mobile: tap-outside, close button in overlay, swipe-down on handle (works inside modal)
- Tabs: `Now Playing | Library | Options`
- Tab parity desktop/mobile (3 tabs both). No platform branching in tab strip.

#### Tab: Now Playing
- ROM header: art, title, MBC + battery + RTC chips, last played
- Action row: `[Resume]` `[Reset]` `[Fullscreen]`
- Quick saves: horizontal scroll-snap strip of slots (1-9), each = thumb + timestamp
  - Empty slots = dashed placeholder "Save here"
  - Long-press / right-click slot = delete/overwrite menu
- Battery saves: vertical list of banks
- Empty state ("no ROM loaded"): "Pick from Library" CTA → switches to Library tab

#### Tab: Library
- Same rails as HomeHub: hero (live session pinned), recent, library, homebrew
- ROM card click = switch game (auto-snap current). Overlay closes, Play starts.
- Drop zone embedded
- No "Home" link — user has HomeHub as landing route already (browser back hijack returns there)

#### Tab: Options
Section list (iOS Settings / Discord style):
- Display (palette, ghosting, pixel-perfect, CGB color)
- Audio (volume, channel mutes)
- **Controls** (bindings on desktop, virtual-pad layout on mobile, both on hybrid devices)
- HUD (chips: FPS, frame counter, input, CPU, frametime histogram, speedrun preset)
- Wake lock / orientation lock
- **Advanced** (gated by `debugUnlocked`): debug window, log filters, breakpoints — keep current Debug UI here; later UX pass will revisit
- About (footer link → modal or sub-page w/ AboutView content)

### Palette (unchanged)
`⌘K` / `Ctrl+K`. Same `commands.ts` registry. Visible chip on desktop, hidden on `pointer: coarse`.

## Killed components

- `BurgerMenu.svelte` — uses both die
- `PlaySheet.svelte` — replaced by overlay
- `RomDrawer.svelte` — replaced by overlay Now-Playing tab + Library tab
- `WindowOverlays.svelte` saves/options/bindings/about/debug windows — folded into overlay
- `showSavesWindow`, `showBindingsWindow`, `showAboutWindow`, `showDebugWindow` stores
- Play topbar (`.play-topbar` in `Player.svelte`)
- HomeHub resume pill (hero card replaces it)

## Routing & deeplinks

- `/` → HomeHub
- `?rom=<name|sha1|uri>` → bypasses HomeHub, straight to Play (deeplink user came for that ROM)
- `#rom=<sha1>` →
  - in HomeHub: opens Library-tab-style ROM preview? No — keep simple: opens Combo overlay at Now-Playing tab if loaded matches, else opens preview card; same effect either way
  - in Play: opens overlay at Now Playing tab (shows that ROM's info)
- `?debug=1` → still unlocks debug section under Options→Advanced

### Browser back button
Hijack:
1. If overlay open → close overlay
2. Else if in Play → navigate to HomeHub
3. Else → leave app (browser handles)

## Onboarding

- Card shown first launch only
- Persistence: bool in IDB-backed prefs (`OnboardingDismissed`), not localStorage
- Text desktop: "Press `Esc` or hover the left edge to open menu"
- Text mobile: "Tap the screen to open menu"
- Dismiss on first overlay open OR explicit close button
- Render gated by `$effect` after IDB read resolves (~10ms, no flash)

## Gestures & input (mobile reality check)

- Swipe-to-OPEN dropped (browser eats top/bottom/edge swipes)
- Single-tap canvas = sole opener
- Double-tap canvas = fullscreen
- Swipe-down inside overlay handle = dismiss (works, modal eats touches before browser)
- `touch-action: none` on canvas only — system gestures unaffected at viewport edges

## Toasts & notices

- `Motd.svelte`, `AudioStatusNotice.svelte` → emit via `Toaster.svelte` instead of floating top-of-screen
- One transient notice layer. No conflicts with transient title strip on Play.

## Future considerations (logged, not built)

- Play view "modes" / layouts: streamer mode, speedrun mode, debugger mode
  - Each = canvas + different overlay-layer composition (HUD chips, debug panels, frametime histograms)
  - Architecture must keep Play view composable: canvas slot + pluggable overlay layer
  - Current code mostly already supports this (HUD chips toggle independently)
  - Mode selection lives under Options→HUD or new Options→Layout when implemented

## Phased implementation

### Phase 1 — Overlay shell
- Build `Overlay.svelte` component
- Tab strip + body slot
- Auto-pause on open, resume on close
- Triggers wired: Esc (desktop), single-tap canvas (mobile), rail icon click
- Animation: fade backdrop + scale-in center on desktop, slide-up on mobile
- Empty tab content placeholders

### Phase 2 — Now Playing tab
- Port `RomDrawer` header (art, title, chips) into tab
- Add action row: Resume, Reset, Fullscreen
- Build horizontal `SaveSlotStrip.svelte` (scroll-snap, thumbnails)
- Port battery banks list from existing `BatterySaveBanks.svelte`
- Empty state when no ROM loaded

### Phase 3 — Library tab
- Reuse `HomeHero`, `ContinuePlayingRow`, `RomsSection` as tab content
- ROM card click handler: auto-snap current → switch
- Embed drop zone (desktop)

### Phase 4 — Options tab
- Port `OptionsView` w/ section list
- Add Controls sub-page: bindings on desktop, pad config on mobile
- Move debug into Advanced sub-page (gated by `debugUnlocked`)
- About sub-page from existing `AboutView`

### Phase 5 — Play view strip
- Remove `.play-topbar` from `Player.svelte`
- Add transient title strip component (Netflix-style, mid-alpha bg, fade)
- Add desktop left rail (2 icons, auto-hide, hot-zone reveal)
- Hide drop affordance text on `pointer: coarse`

### Phase 6 — HomeHub topbar
- Strip burger + resume pill from `HomeHub.svelte`
- Add `⚙` gear icon → opens Combo overlay at Options tab (or standalone Options modal — TBD, prefer overlay for unity)
- Keep palette chip desktop

### Phase 7 — Wiring & cleanup
- Deeplink routes (`?rom=`, `#rom=`)
- Browser back hijack via `popstate`
- Onboarding card + IDB-backed `OnboardingDismissed` flag
- Delete dead components: BurgerMenu, PlaySheet, RomDrawer, dead window stores
- Update palette `commands.ts` if any commands obsoleted

### Phase 8 — Polish
- Toaster absorbs Motd + AudioStatusNotice
- Animation tuning (overlay, title strip, rail fade)
- Onboarding card final copy
- Cross-platform QA (desktop + mobile, landscape + portrait, fullscreen)

## Open follow-ups (post-lock)

- HomeHub `⚙`: opens Combo overlay vs standalone Options modal — defer; lean toward overlay for surface unity
- Title strip return triggers — exact UX of "show again on activity": tune in Phase 5
- Rail icons: icon set (Library = 📚 or `library` icon, Options = ⚙ or `cog`) — match existing Icon component
