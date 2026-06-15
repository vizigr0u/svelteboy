# Remove Homebrew + Remote-ROM UI

Status: DRAFT 2026-06-14
Scope: **UI-only**. Strip every user-facing surface for homebrew manifest import
and remote (uri-source) ROMs. Keep low-level uri/cloud plumbing dormant for future
Dropbox/Drive library sync.

## Decision

- Remote ROM = `RomSource.kind === 'uri'`, fetched from arbitrary URL.
- Homebrew = manifest bulk-import (`bulkImportFromManifest`).
- Kill: all UI entry points + homebrew manifest path (manifest types die with it).
- Keep dormant: `RomSource` `'uri'`/`'cloud'`, `getRomBuffer` uri branch,
  `addLibraryRomFromUri`, `promoteUriToIdb`, `findLibraryRomByUri`,
  `reconcileSha1OnFirstPlay`, idb `txAddUriRom`/`txPromoteUriToIdb`/`normalizeSha1ForUri`.
  No caller after this change — intentional, revived by sync feature later.

## Changes by file

### Remove (homebrew manifest — dead with last UI caller)
- `stores/libraryStore.ts`: delete `bulkImportFromManifest` (183-206); drop
  `RemoteRomsList` import (14).
- `types.ts`: delete `RemoteRomLocation` + `RemoteRomsList` (168-177).

### `lib/RomsSection.svelte`
- Remove imports: `bulkImportFromManifest`, `LibraryImportSourceUri`,
  `DismissBadgeHint`, `LibrarySource`, `LibrarySourceFilter`.
- Delete `addSpecialSource()` (135-157).
- Delete "Browse homebrews…" button in empty-CTA (213-215); keep "Choose ROM file…".
- Delete add-source "+" button (240-248) + `.add-source` css.
- Delete `hasOnlyRemote` (122-125) + badge-hint block (219-229) + `.badge-hint` css.
- Delete Source filter: `sourceOptions` (67-71), `passesSource` (82-86), its use in
  `sortedRoms` filter, Source `<select>` (269-276). All ROMs local now.

### `lib/RomView.svelte`
- Remove `promoteUriToIdb` import.
- Delete `isRemoteOnly` (75), `saveLocally()` (121-127), Save-locally button (207-221),
  `rom-remote-only` class binding (141) + css (377-382).
- Simplify `getRomDescription` (116-119) → always `""`, or drop description row.
- `kindIcon`/`kindTitle` (88-101) + `.kind-badge`: all local → drop badge, or hard-code
  "Stored locally". Lean: drop badge.

### `lib/RomDrawer.svelte` (slated for deletion in ux-streamline P7 anyway)
- Remove `promoteUriToIdb` import, `onPromote()` (93-98), Add-to-library button (138-140).

### `lib/overlay/OptionsTab.svelte` + `lib/OptionsView.svelte`
- Remove `AutoSaveUriRoms` import + "Auto-save URI ROMs" checkbox (OptionsTab 192-193,
  OptionsView 238-243). Store + rom.ts auto-promote logic stay dormant (defaults true).

### `App.svelte`
- Delete `?rom=uri` deeplink branch (120-135). Keep `sha1` + `name`.
- Remove `findLibraryRomByUri` import; check `LibraryRom`/`Date.now` imports now unused.
- `parseRomParam` (utils.ts): drop `'uri'` DeeplinkKind branch (43-46) → unknown URL
  falls through to `name`. Keep `DeeplinkKind` type minus uri variant.

### Option stores (`stores/optionsStore.ts`)
- `LibraryImportSourceUri` (24): homebrew-only → remove.
- `LibrarySource` + `LibrarySourceFilter` (28-29): filter UI gone → remove.
- `AutoSaveUriRoms` (25): keep (gates dormant promote plumbing).

### Tests (`stores/library.test.ts`)
- `addLibraryRomFromUri skips dup uri` (182-186): plumbing kept → **keep test**.

## Verify
- `pnpm test` green.
- Build: no unused-import / type errors (uri plumbing has no caller but still typechecks).
- Manual: HomeHub + overlay Library — no homebrew button, no Source filter, no remote
  badges; drop/import local ROM works; `?rom=<sha1>` + `?rom=<name>` deeplinks work;
  `?rom=<url>` now treated as name (no fetch).

## Out of scope
- Backend/wasm: untouched.
- Cloud-sync feature: future, reuses kept plumbing.
