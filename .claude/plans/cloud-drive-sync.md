# Cloud Sync (Google Drive) — Plan

Add user-owned Google Drive as the cross-device store for battery saves, savestates,
preferences, and (opt-in) ROMs. IndexedDB stays as the local cache / source of truth for
the running session; Drive is the durable cross-device backing store.

## Decisions (locked)

| Topic | Choice | Consequence |
|-------|--------|-------------|
| Provider | **Google Drive only** | One auth path. Abstract behind a `CloudProvider` interface anyway so Dropbox/WebDAV can slot in later. |
| Backend | **Strictly client-only** | GIS token model, PKCE-less token client, no refresh token, no server to run. |
| Sync model | **Manual "Sync now" + auto-flush** on pause / tab-hide / close, + pull-on-open | No background polling. Fully reliable, dodges the 1h-token / background-throttle problems. |
| ROM cache | **Cache-after-first-download** | Drive is source of truth + cross-device fetch; first play downloads + caches in IDB for offline + instant relaunch. |
| Conflicts | **Fork conflicted copy** (detect via Drive `version`) | Never silently lose a save. Loser becomes a labelled copy surfaced in UI. |
| ROMs in cloud | **Opt-in per user** | User owns legality; stored in their own private Drive folder. |
| Phasing | **Saves+prefs first, ROMs later** | Phase 1 = small data, no resumable-upload complexity. |

## Why client-only "live sync" was dropped

GIS issues only ~1h access tokens, **no refresh token in the browser**. Silent renewal
(`prompt:''`) needs a live Google session + works only when the tab is foregrounded
(background timers are throttled). Truly unattended always-on sync is impossible without a
backend. Manual + auto-flush-on-lifecycle gives reliable sync at the moments that matter
(user stops playing / switches device) without any of that fragility.

---

## Architecture

```
src/cloud/
├ provider.ts        ← CloudProvider interface (future Dropbox/WebDAV slot in here)
├ driveAuth.ts       ← GIS load, token client, ensureToken(), 401-retry, signOut
├ driveClient.ts     ← thin fetch wrapper: ensureAppFolder, list, getMeta,
│                       download(alt=media,Range), uploadMultipart, uploadResumable,
│                       patchAppProperties
├ syncEngine.ts      ← reconcile loop over registered SyncAdapters
├ syncMeta.ts        ← local-only IDB store: per-entity {driveFileId, lastHash,
│                       lastVersion, lastSyncedAt} + deviceId
└ adapters/
  ├ batterySaveAdapter.ts
  ├ saveStateAdapter.ts
  ├ prefsAdapter.ts
  └ romAdapter.ts        (phase 2)

src/stores/cloudStore.ts  ← Svelte stores: authState, syncStatus, lastSyncAt, conflicts[]
```

### Auth (`driveAuth.ts`)
- Load `https://accounts.google.com/gsi/client`, `google.accounts.oauth2.initTokenClient`.
- Scope: **`drive.file`** (non-sensitive — no CASA audit, no "unverified app" 100-user cap,
  user-visible files so they can see/back up their library). Optionally add `drive.appdata`
  for hidden sync-state if we ever move it off-device.
- Token kept **in a module variable only** (never localStorage — XSS exfil risk). Lost on
  reload → silently re-request; interactive re-prompt on user gesture / 401.
- `ensureToken()`: returns cached token if valid; else silent `requestAccessToken({prompt:''})`;
  on failure surface "Reconnect Drive" CTA.

### Drive layout (`drive.file`, user-visible)
```
SvelteBoy/                       (one app folder, found/created by name+appProperties tag)
├ saves/   <sha1>__<bankId>.sav  appProps: {sha1, bank, device, kind:'battery'}
├ states/  <sha1>__slot<N>.svby  appProps: {sha1, slot, device, kind:'state'}
├ roms/    <sha1>.gb             appProps: {sha1, name, kind:'rom'}   (phase 2)
└ prefs.json                     appProps: {kind:'prefs'}
```
Files keyed by **Drive file ID** (stored in `syncMeta`), never by name. Thumbnails embedded
in the savestate blob (already base64 in `saveStateDb`).

### Sync metadata (`syncMeta.ts`, local IDB, never synced)
Per logical entity key → `{ driveFileId, lastHash (sha-256 of bytes), lastVersion (Drive
file.version), lastSyncedAt }`. Plus a persisted random `deviceId` (conflict labelling).

### Reconcile (per entity, `syncEngine.ts`)
```
localChanged  = sha256(localBytes) !== meta.lastHash
remoteChanged = driveMeta.version  !== meta.lastVersion   // re-GET version before deciding
```
| local | remote | action |
|-------|--------|--------|
| no | no | skip |
| yes | no | **push** (multipart update) → store new version+hash |
| no | yes | **pull** (download) → write to local DB → store version+hash |
| yes | yes | **conflict → fork** |

**Conflict fork** maps onto existing structures:
- Battery save → write remote into active bank, save local as a **new bank** `"Conflict <device> <hh:mm>"` (multi-bank already exists in `batterySaveDb`).
- Savestate → keep remote in the slot, push local to a free/`:conflict` slot.
- Prefs → **field-level last-write-wins merge** (per-key), conflicts are rare and low-stakes.

Surface fork events in `cloudStore.conflicts[]` → toast + Cloud settings list.

### Triggers (manual model)
- **Pull-on-open**: after auth, reconcile once.
- **"Sync now"** button: full reconcile.
- **Auto-flush (push dirty only)**: reuse existing lifecycle hooks —
  `lifecycle.ts` visibility-hidden / `pagehide`, `autoSnap` pause/ROM-swap triggers —
  debounced ~5s, hash-compare so no-op ticks cost nothing.

---

## Phase plan

### Phase 0 — Drive plumbing
- `provider.ts`, `driveAuth.ts`, `driveClient.ts`, `cloudStore.ts`.
- GCP project + OAuth client ID; authorized JS origins = GH Pages URL + `localhost:5173`.
- Cloud settings pane in the in-progress drawer (`src/lib/drawer/GeneralPane.svelte`):
  Connect/Disconnect Drive, account email, status line.
- **Done when**: login works, app folder auto-created, a test blob round-trips
  (upload → list → download → byte-equal).

### Phase 1 — Saves + prefs sync
- `syncMeta.ts`, `syncEngine.ts`, adapters: battery, savestate, prefs.
- Conflict-fork logic per above. "Sync now" + auto-flush + pull-on-open wired.
- **Done when**: save on browser A → Sync → pull on B shows it; concurrent edit on A&B →
  conflict bank/slot appears, nothing lost.

### Phase 2 — ROMs (opt-in)
- `romAdapter.ts`: **resumable upload** for 8MB files (256KB chunks, 308-resume).
- Wire the already-stubbed `{kind:'cloud'}` source in `types.ts:25` / `rom.ts` (currently
  throws "not implemented"): `getRomBuffer` for a cloud rom → check IDB cache → else
  download from Drive (`alt=media`, Range-resumable) → **write to `cart_roms` cache** → return.
- "Back up ROMs to Drive" toggle (global) + per-rom "keep local copy" override.
- Library metadata synced as part of `prefs.json` (or a sibling `library.json`) so a fresh
  device sees the full library as cloud-sourced entries before any rom is downloaded.
- **Done when**: back up rom on A; fresh B logs in → library lists it → first play
  streams+caches → second play is offline-instant.

### Phase 3 — polish
- Per-file/transfer progress UI; exponential backoff + jitter on 403/429.
- Milestone-only `keepForever` revisions (never per-save — 200/file cap).
- Optional upgrade path: Changes-API poll for opportunistic foreground live-ish sync.
- Consider client-side encryption of save blobs (note: no server secret available).

---

## Risks / notes
- **OAuth consent**: `drive.file` is non-sensitive → normal consent screen, no annual CASA,
  no 100-user cap. Avoid full `drive` scope (would trigger restricted verification + CASA).
- **Token volatility**: in-memory only; reload = re-auth. Acceptable under manual model.
- **Quotas**: a save every few seconds = ~1k units/min, far under 325k/min/user; hash-compare
  + debounce keeps it negligible. Backoff with jitter on the rare 429.
- **Transport**: raw `fetch()` + `Authorization: Bearer`; no `gapi` bundle. `gapi.auth2` is
  dead — GIS only.
- **Hashing**: ROMs already have sha1; saves/prefs hashed with WebCrypto sha-256.
- **Abstraction**: keep everything behind `CloudProvider` so Dropbox/WebDAV are additive,
  not a rewrite.
```
```
