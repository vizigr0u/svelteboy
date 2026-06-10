# ROM Library UX Revamp Plan

Evolve current `RomsSection` + card-style `RomView` into a card-grid + slide-out detail drawer model. Foundation already strong (sha1 dedup, filters, sort, search, IDB+URI sources, render-mode override per ROM). Plan fills gaps: rich card badges, dedicated detail drawer, full cartridge metadata surfacing, save slots with thumbnails per ROM, expanded per-ROM prefs.

**Scope: frontend only.** No WASM API change required (uses existing `extractMetadata`, `getLastSave`).

## Current State (already shipped — do NOT redo)

- `LibraryRom` model: sha1, source `{kind:'idb'|'uri'}`, lastPlayedAt, addedAt, cgbFlag, renderMode override, fileSize, originUri → `src/stores/libraryStore.ts`
- Library view: search, source filter (All/Local/Remote), type filter (GB-compat/CGB-only), sort (last played/added/name) → `src/lib/RomsSection.svelte:25-78`
- Card UI: thumbnail (libretro CDN), kind-badge (cloud/hard-drive icon), CGB pill, render-mode radio (auto/GB/CGB), Play, Save-locally, Delete → `src/lib/RomView.svelte`
- Unified grid mixes installed + remote ROMs already → `src/lib/RomList.svelte`
- Window/drawer infra exists → `src/lib/Window.svelte`, `WindowSkeleton.svelte`, `BurgerMenu.svelte`
- Save management: `SavesViewer.svelte`, `QuickSaveControls.svelte` (standalone, not per-ROM in library)
- Confirm dialog primitive: `src/stores/confirmStore.ts`
- Toaster: `src/stores/toastStore.ts`

## Gaps (what plan addresses)

1. **No detail drawer.** Render-mode + delete are inline on every card → clutters grid, no room for richer per-ROM data.
2. **Card metadata thin.** Only kind icon + CGB pill. No MBC, RTC, battery, save-presence, size badges.
3. **MBC metadata not stored.** `extractMetadata()` WASM API exists but result not persisted on `LibraryRom`; UI cannot show MBC type/RTC/battery without parsing on every render.
4. **Saves disconnected from library.** `SavesViewer` lists all saves globally; no per-ROM "Saves" tab; no quick-save slot thumbnails in library context.
5. **Per-ROM prefs limited.** Only `renderMode`. No palette override, no per-ROM channel mute, no skip-boot-ROM toggle.
6. **Empty state unverified.** New users may see blank grid with no guidance.
7. **Catalog discovery flat.** Remote ROMs interleaved with installed; no "Discover" / "Featured" affordance for homebrews.

---

## Phased Implementation

### Phase 1 — Metadata enrichment (foundation, no UI change)

Persist cartridge metadata on `LibraryRom` so cards/drawer can render badges without re-parsing.

**Backend:** `extractMetadata(rom)` already returns `{title, cartridgeType, cgbFlag, romSizeByte, ramSizeByte, hasBattery, romBankCount, ramBankCount}` → `assembly/index.ts`.

**Type extension** (`src/types.ts`):
```typescript
type LibraryRomMeta = {
  cartridgeType?: number;   // raw byte from header 0x0147
  hasBattery?: boolean;
  hasRtc?: boolean;          // derived from cartridgeType ∈ {0x0F, 0x10}
  hasRumble?: boolean;
  mbcKind?: 'none' | 'mbc1' | 'mbc2' | 'mbc3' | 'mbc5';
  romBankCount?: number;
  ramBankCount?: number;
  romSize?: number;          // bytes
  ramSize?: number;
};
type LibraryRom = /* existing */ & LibraryRomMeta;
```

**Migration:** on `addLibraryRomFromBuffer`, call `extractMetadata(buffer)`, derive `mbcKind`/`hasRtc`/`hasRumble` from cartridge-type byte (table in `spec_cartridge_header` memory), store on row. Existing rows lazy-fill on first load via `ensureCartMeta(rom, buffer)` helper modeled after `ensureCgbFlag` at `src/stores/libraryStore.ts:37-42`.

**Test:** `src/stores/library.test.ts` extend — add MBC3+RTC fixture (e.g., Pokémon Crystal header), assert `mbcKind==='mbc3' && hasRtc===true`.

**Files:** `src/types.ts`, `src/stores/libraryStore.ts`, `src/cartType.ts` (add MBC parsing), `src/stores/library.test.ts`.

---

### Phase 2 — Card badges + visual polish (no architecture change)

Surface new metadata on existing `RomView` card. Keep card a 1-click-to-play surface; details move to drawer in phase 3.

Add badge row under cart-type pill:
- `RTC` (clock glyph) if `hasRtc`
- `BATT` (battery glyph) if `hasBattery`
- `MBC3` / `MBC5` etc. small mono chip if `mbcKind` known
- `HAS SAVE` dot (save count from `idbStore` save index lookup, async derived)
- Size in human-readable form (existing `humanReadableSize` util)

Dim cards where `source.kind==='uri'` and ROM not yet promoted to IDB (catalog vs owned visual distinction — pattern from Steam dim-on-uninstalled).

Add per-card "Open details" affordance: tap card body (not Play button) → opens drawer (phase 3). Until phase 3 lands, click is a no-op or routes to existing inline controls.

**Files:** `src/lib/RomView.svelte`, `src/lib/icons/` (add `clock`, `battery`, `bookmark` if missing).

---

### Phase 3 — Detail drawer (UX core)

New component: `RomDrawer.svelte` — slide-out right panel, dismiss on click-out / Esc / drawer X.

Layout (top to bottom):
1. **Header strip**: large thumbnail, title, kind icon, install state CTA (`Add to library` for `uri`-source, none for `idb`), close X.
2. **Metadata chips row**: cart type, MBC kind, ROM size, RAM size, RTC, battery, CGB flag.
3. **Tabs**: Play · Saves · Settings · About.

**Play tab:** big Play button (resume if save exists), recent thumbnail (from quick-save slot 0 if present), last-played timestamp, "Reset and play from boot" secondary.

**Saves tab:**
- **Quick saves**: slot grid (e.g., 1-9), each shows thumbnail (already captured by `src/emulator/saveState.ts`), timestamp, Load / Overwrite / Delete. Empty slot = `+` placeholder.
- **Battery save**: SRAM presence card with last-modified, Export `.sav`, Import drop zone, Delete (confirm).
- Top-right: Export all / Import bundle (zip of `.sav` + `.state` slots).

**Settings tab (per-ROM, persisted by sha1):**
- Render mode (auto / DMG / CGB) — move from card to here
- Force palette (only if DMG-grey path retained as option)
- Skip boot ROM toggle
- Per-channel mute (CH1/2/3/4)
- Custom save-slot count (default 9)
- "Saved" toast on each change — no Save button (mGBA anti-pattern).

**About tab:** SHA1, filename, file size, origin URI (if remote), added-at, last-played, MBC chip, notes (free-text user field, persisted).

Drawer state: `selectedRomSha1: Writable<string | undefined>` in `windowStores.ts`. Library card click sets it; drawer subscribes; URL hash `#rom=<sha1>` reflects state for back-button + deep link.

**Files:** new `src/lib/RomDrawer.svelte`, new `src/lib/RomDrawer/PlayTab.svelte`, `SavesTab.svelte`, `SettingsTab.svelte`, `AboutTab.svelte`. Refactor `src/lib/SavesViewer.svelte` content into reusable `SaveSlotGrid.svelte` component used both standalone and in SavesTab.

`romStores.ts` extend with per-ROM prefs map keyed by sha1, persisted to IDB via existing `idbStore.ts`.

---

### Phase 4 — Saves persistence per ROM (data layer)

Today saves likely keyed by loaded cart slot only. To populate Saves tab without an in-RAM cart:

- Add IDB store `romSaves` keyed `{sha1, slot}`, value = `{bytes, thumbnail, savedAt}`. Slot `'battery'` reserved for SRAM, numeric slots 1-N for quick-saves.
- Migrate existing save records on load.
- `QuickSave` / `QuickLoad` paths in `src/emulator/saveState.ts` write keyed by current `loadedCartridge.sha1`.
- SavesTab reads by sha1 only (no need for cart loaded).

**Test:** load ROM A, quicksave slot 1, switch to ROM B, open ROM A drawer → slot 1 still visible with thumbnail.

**Files:** `src/stores/idbStore.ts` (schema bump + migration), `src/emulator/saveState.ts`, `src/lib/RomDrawer/SavesTab.svelte`.

---

### Phase 5 — Empty state + Discover

- **Empty library state** (no IDB + no remote): centered drop zone, copy "Drop a `.gb` or `.gbc` ROM here", below it "Or browse homebrews" → scrolls to remote section. → `RomsSection.svelte` empty branch.
- **Discover row** (top of grid when filter = All): horizontal scroll of featured homebrews from manifest. Optional, only if homebrew manifest tagged `featured: true`.
- **First-run hint**: subtle toast or inline banner explaining install state badges.

**Files:** `src/lib/RomsSection.svelte`, `src/assets/homebrews.ts` (add featured tag).

---

### Phase 6 — Polish + nits

- Keyboard navigation: arrow keys move card focus, Enter opens drawer, Esc closes.
- Drawer width responsive: 480px desktop, full-width mobile.
- Deep-link `#rom=<sha1>` opens drawer on page load (compose with existing `?rom=` deep-link plan).
- Filter persistence: already partial via `optionsStore`; verify search query NOT persisted (privacy).
- Sort: add "Size" + "MBC type" options now that metadata present.
- Card grid virtualization if library > 200 rows (`MyVirtualList.svelte` already exists).
- A11y: drawer has `role="dialog"`, focus trap, return focus to card on close.

---

## Out of Scope (defer or skip)

- Box-art scraping pipeline beyond libretro CDN (already in place).
- Achievements / playtime tracking (RetroAchievements pattern) — separate epic.
- Cloud sync of saves — separate epic.
- Multi-select bulk operations (delete N ROMs at once).
- Edit cartridge metadata (header is read-only).

## Anti-patterns codified (do NOT regress)

1. Do not split installed vs remote into separate sections — unify, badge state (itch lesson).
2. Do not surface settings reverts silently — toast on every per-ROM pref change (mGBA lesson).
3. Do not modal-trap the user — drawer dismissible by Esc/click-out (Adobe Spectrum lesson).
4. Do not hide auto/quick saves — every save record visible + deletable in Saves tab (OpenEmu lesson).

## Acceptance Criteria (per phase, runnable manually)

- **P1:** Add MBC3+RTC ROM via drop → `LibraryRom` row contains `mbcKind:'mbc3'`, `hasRtc:true`. Reload page → persists from IDB.
- **P2:** Same ROM → card shows `MBC3` + `RTC` + `BATT` chips next to existing CGB pill. Remote ROM dimmed vs installed.
- **P3:** Click card body → drawer opens, all 4 tabs render. Change render-mode in Settings tab → "Saved" toast, library card reflects update.
- **P4:** ROM A quicksave slot 1, switch ROM, return to ROM A drawer → slot 1 thumbnail visible without loading ROM A.
- **P5:** Clear IDB + block manifest → empty state renders dropzone copy; with manifest → Discover row visible.
- **P6:** Tab/arrow nav works, drawer survives reload via hash, focus returns on close.

## Files Touched (summary)

| Phase | File | Change |
|------|------|--------|
| 1 | `src/types.ts` | extend `LibraryRom` |
| 1 | `src/stores/libraryStore.ts` | persist meta on add |
| 1 | `src/cartType.ts` | MBC parsing helpers |
| 1 | `src/stores/library.test.ts` | MBC3 fixture test |
| 2 | `src/lib/RomView.svelte` | badge row, dim remote |
| 2 | `src/lib/icons/` | new glyphs |
| 3 | `src/lib/RomDrawer.svelte` (new) | drawer shell |
| 3 | `src/lib/RomDrawer/*Tab.svelte` (new ×4) | tab content |
| 3 | `src/lib/SaveSlotGrid.svelte` (new) | reusable slot grid |
| 3 | `src/stores/windowStores.ts` | `selectedRomSha1` |
| 3 | `src/stores/romStores.ts` | per-ROM prefs map |
| 4 | `src/stores/idbStore.ts` | `romSaves` store, migration |
| 4 | `src/emulator/saveState.ts` | key by sha1 |
| 5 | `src/lib/RomsSection.svelte` | empty state + Discover |
| 5 | `src/assets/homebrews.ts` | `featured` tag |
| 6 | various | a11y, virtualization, deep-link |

## Open Questions

- Save slot count default: 9 (EmulatorJS) or unlimited list? → 9 default, configurable per-ROM in Settings tab.
- Drawer vs route page on mobile? → drawer full-width; back gesture closes via hash navigation.
- Should "Force palette" expose 3 DMG palettes (grey/green/pocket) or only auto/DMG/CGB? → start with auto/DMG/CGB, expand if user asks.
- Where do bulk import (manifest) live in new layout? → keep button in `RomsSection` header next to source filter.
- ROM notes field — persist where? → per-ROM prefs in IDB; surfaced in About tab.

## Next Action

Land **Phase 1** first as a standalone PR. UI unchanged; only data model + persistence + test. Once metadata in place, Phase 2 (badges) is cheap. Phase 3 (drawer) is largest — break into sub-PRs per tab if needed.
