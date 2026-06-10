# Auto-Snapshot ("Resume Anywhere") Plan

## Goal

Persist last play position automatically so Resume restores exact frame across page reload, ROM swap, and tab kill — without touching user's manual quick-save slots.

## Spec (locked with user)

| Aspect | Decision |
|---|---|
| Cadence | 30s wall-clock interval **while emu running** + on home-exit + on ROM swap + on `visibilitychange === 'hidden'` |
| Debounce | Skip if <10s since last successful snap |
| Skip when | Paused, debugger attached, or `GameFrames` unchanged since last snap |
| Slot model | 1 autosnap per ROM, overwrite (separate IDB key from user quick saves) |
| Resume priority | Live in-memory session wins. Autosnap loaded only on cold load (no live session or different ROM) |
| Restart action | Purge autosnap before cold boot |
| PlayTab thumb source | Switch from `slot 1` to autosnap |
| Hero on cold load | Show "Resume" CTA if autosnap exists for hero ROM; click → load ROM + restore autosnap |
| Thumbnail encode | Main thread (matches existing `quickSave`), no worker for v1 |
| Date label | "Just now" <60s, `Xm/Xh/Xd ago`, absolute past 7d; refresh every 30s while visible |
| Opt-out | Global toggle in Options, default ON |
| Animation | None — silent snap (no `QuickSaveFlyer` set) |

---

## Data model

### IDB key

Reuse existing `svelteboy-savestates` DB / `states` store. New key format:

```
${romSha1}:auto      // autosnap (one per ROM)
${romSha1}:slot${N}  // user slots, unchanged (N=1..)
```

Slot 0 stays unused → reserves room if we ever want a multi-slot autosnap ring.

### Entry shape

Reuse existing `SaveStateEntry` (`state: Uint8Array, thumbnail?: string, savedAt: number`). No schema change.

---

## File-by-file changes

### 1. `src/saveStateDb.ts`

Add autosnap helpers next to existing slot helpers.

```ts
const AUTO_SUFFIX = ':auto';
function autoKey(romSha1: string): string { return `${romSha1}${AUTO_SUFFIX}`; }

export async function saveAuto(romSha1: string, entry: SaveStateEntry): Promise<void>
export async function loadAuto(romSha1: string): Promise<SaveStateEntry | null>
export async function deleteAuto(romSha1: string): Promise<void>

// notify subscribers (PlayTab, Hero, ContinuePlayingCard)
export const autoSnapVersion = writable(0);
```

Implementation mirrors `saveSlot` / `loadSlot`. Use **explicit `tx.commit()`** (per research) to maximize chance of flush during `visibilitychange`. Don't await `onsuccess` in the visibility path — let it be fire-and-forget; bump `autoSnapVersion` on `tx.oncomplete` for UI reactivity in normal flow.

### 2. `src/emulator/autoSnap.ts` (NEW)

Module owns the scheduler + write side. Public surface:

```ts
export function startAutoSnapScheduler(): void   // called once at app boot
export function stopAutoSnapScheduler(): void    // teardown (HMR)
export async function snapNow(reason: 'interval' | 'exit' | 'swap' | 'hidden'): Promise<void>
export async function purgeAutoForCurrentRom(): Promise<void>
```

Internals:
- `setInterval(tick, 30_000)` — `tick()` calls `snapNow('interval')`.
- `tick()` early-returns if: `!loadedCartridge`, `EmulatorPaused`, `DebuggerAttached`, `!AutoSnapEnabled`, `GameFrames === lastSnapFrameCount`, or `Date.now() - lastSnapAt < 10_000`.
- `snapNow()` shared path:
  - Compute `wasRunning = !EmulatorPaused`.
  - `pauseEmulator()` + `if (!isAtFrameBoundary()) backendRunOneFrame()`.
  - `createSaveState()` — return if empty.
  - Encode thumbnail (same `captureFrameThumbnail` / `captureCgbFrameThumbnail` extracted/shared with `saveState.ts`).
  - `await saveAuto(sha1, { state, thumbnail, savedAt: Date.now() })`.
  - `lastSnapAt = Date.now(); lastSnapFrameCount = GameFrames`.
  - **No `QuickSaveFlyer.set()`** — silent.
  - `if (wasRunning) runUntilBreak()`.
- For `reason === 'hidden'`: skip debounce gate but still skip if paused/debugger/no-frames-advanced.
- For `reason === 'exit' | 'swap'`: snap target is the **currently-loaded** ROM (the one being left), not the new one.

Reuse the thumbnail encoders by extracting `captureFrameThumbnail` + `captureCgbFrameThumbnail` from `saveState.ts` into a small `src/emulator/snapshotThumbnail.ts` shared by both `quickSave` and `snapNow`.

### 3. `src/emulator/lifecycle.ts`

Augment the existing `visibilitychange` handler:

```ts
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        snapNow('hidden').catch(() => {}); // fire-and-forget
        if (get(PauseOnVisibilityLost) && !get(EmulatorPaused)) { ... }
    } else { ... }
});
```

Also add `pagehide` belt-and-suspenders for desktop bfcache scenarios:

```ts
window.addEventListener('pagehide', () => { snapNow('hidden').catch(() => {}); });
```

Call `startAutoSnapScheduler()` at module load; `import.meta.hot.dispose` calls `stopAutoSnapScheduler()`.

### 4. `src/stores/viewStore.ts`

`goToHome()` snaps before pausing:

```ts
export async function goToHome(): Promise<void> {
    await snapNow('exit').catch(() => {});
    pauseEmulator();
    playViewActive.set(false);
}
```

(Or fire-and-forget if blocking the nav feels bad — tradeoff: a non-awaited snap can race with `resetEmulator` if user immediately swaps ROMs. Recommend `await` since snap is ~20ms.)

### 5. `src/emulator/rom.ts` (`playRom`)

Snap previous ROM before swap, then purge the new ROM's stale autosnap **only if** user explicitly chose "Restart" path. Distinguish in API:

```ts
// Already-called by Hero "Resume" button on cold load:
export async function resumeRom(rom: LibraryRom): Promise<void> {
    await playRom(rom, { skipAutoSnapOfPrevious: false });
    const entry = await loadAuto(rom.sha1);
    if (entry) { /* loadSaveState + handle audio like quickLoad */ }
}

// Existing call sites that want cold boot (Restart, ContinuePlayingCard "Play"):
playRom(rom, { purgeAutoOnLoad: true })
```

Inside `playRom`:
- Before any awaits, if `loadedCartridge` exists and differs from incoming → `await snapNow('swap')`.
- After `resetEmulator()`, if `opts.purgeAutoOnLoad` → `await deleteAuto(rom.sha1)`.

### 6. `src/emulator/saveState.ts`

Refactor only:
- Move thumbnail helpers to `snapshotThumbnail.ts`.
- No behavior change to `quickSave` / `quickLoad`.

### 7. `src/stores/optionsStore.ts`

```ts
export const AutoSnapEnabled = MakeLocalStore<boolean>('option-autosnap-enabled', true);
```

### 8. `src/lib/Options*.svelte` (Settings tab)

Add toggle: "Auto-save session every 30s and on exit".

### 9. `src/lib/heroAction.ts`

Extend `resolveHeroAction` to accept `hasAutoSnap: boolean`:

```ts
type ResolveArgs = {
    heroSha1: string;
    loadedSha1: string | undefined;
    emulatorInitialized: boolean;
    hasAutoSnap: boolean;
};
// resume if (loaded && same && initialized) OR (hasAutoSnap)
```

Update `viewResume.ts.shouldAutoResumeOnEnterPlay` similarly if needed (probably not — cold-load Resume goes through `resumeRom`, not `goToPlay`).

### 10. `src/lib/HomeHero.svelte`

- Subscribe to `autoSnapVersion` + reactive `loadAuto(rom.sha1)` → `autoSnapEntry`.
- Pass `hasAutoSnap: !!autoSnapEntry` to `resolveHeroAction`.
- On `primary()` when `action === 'resume'`:
  - If live in-memory session: `goToPlay()` (today's behavior).
  - Else (cold-load): `await Emulator.ResumeRom(rom)` then `goToPlay()`.
- Add a small thumbnail strip + relative date below CTA when `autoSnapEntry` exists and not currently the live ROM.
- Use shared `formatRelativeTime(ts)` util (extract from existing `formatLastPlayed`, generalize the thresholds per spec).

### 11. `src/lib/RomDrawer/PlayTab.svelte`

- Replace `loadSlot(rom.sha1, 1)` with `loadAuto(rom.sha1)` (and subscribe to `autoSnapVersion`).
- Button label: "Resume · 2m ago" when autosnap exists, "Play" otherwise.
- "Reset and play from boot" button stays but is now the explicit purge path → calls `Emulator.PlayRom(rom, { purgeAutoOnLoad: true })`.

### 12. `src/lib/ContinuePlayingCard.svelte`

- Subscribe to `loadAuto(rom.sha1)` + `autoSnapVersion`.
- If autosnap exists: overlay thumbnail over cart art (small badge), show "Xm ago" under title. Optional: clicking the play-overlay calls `Emulator.ResumeRom(rom)` instead of `Emulator.PlayRom(rom)`.

### 13. `src/utils.ts` (or new `src/relativeTime.ts`)

```ts
export function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'Just now';
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
}
```

UI components using this label start a `setInterval(_, 30_000)` to bump a reactive tick while mounted.

### 14. `src/emulator/index.ts`

Export new façade members:
- `Emulator.ResumeRom(rom)` → wraps `resumeRom`
- `Emulator.PurgeAutoSnap(sha1)` → wraps `deleteAuto`

---

## Edge cases

| Case | Behavior |
|---|---|
| Schema bump (state version mismatch) on cold-load Resume | `isValidSaveStateBlob` + `loadSaveState` returns false → toast "Saved session incompatible; starting fresh" + `deleteAuto` + cold-boot ROM. |
| Autosnap exists but no live session & different ROM still loaded | Hero `Resume` triggers `resumeRom(heroRom)` (swap snaps current ROM first, then restore target's autosnap). |
| User toggles AutoSnap off mid-session | Scheduler tick early-returns. Existing autosnaps stay until next Restart/purge. |
| `visibilitychange` fires during a snap-in-progress | Reentrancy guard `let snapInFlight = false; if (snapInFlight) return;`. |
| Debugger attached | Skip — matches `quickSave`. |
| ROM swap from same SHA1 (e.g. file re-pick) | `loadedSha1 === incomingSha1` → skip the `swap` snap (no-op). |
| Tab hidden while emu paused | No snap (nothing to save). |
| IDB quota exceeded | Catch, console.warn, no toast (silent feature). |

---

## Test plan

### Unit (Vitest, `src/lib/*.test.ts` style)

- `heroAction.test.ts` — extend with `hasAutoSnap` cases (cold load + autosnap → 'resume').
- `formatRelativeTime.test.ts` — threshold table (0s, 59s, 60s, 1h, 24h, 7d, 8d).
- `autoSnap.test.ts` — debounce gate, paused/debugger skip, frame-unchanged skip. Mock `createSaveState` + `saveAuto`.

### Integration (manual)

1. Load ROM, play 30s → autosnap key appears in IDB.
2. Refresh page → Hero shows "Resume · 30s ago" + thumbnail. Click → resumes mid-frame.
3. Pause emu, wait 30s, unpause → no extra snap written (frames unchanged gate).
4. Hit Restart → autosnap purged; Hero falls back to "Play".
5. Play ROM A, swap to ROM B via PlayTab → A's autosnap exists, B cold-boots (unless B also had autosnap → that loads).
6. Backgound tab for 5s → autosnap updated; foreground → state intact.
7. Toggle AutoSnap off → 30s passes, no IDB write.
8. With Debugger attached → no snaps.

### Perf check

Profile during 30s tick: confirm pause→runOneFrame→serialize→encode total <30ms (target: indistinguishable from existing `quickSave`).

---

## Rollout phases

| Phase | Scope | PR-able? |
|---|---|---|
| 1 | `saveStateDb` autosnap helpers + thumbnail extraction + `autoSnap.ts` scheduler + Options toggle. No UI changes yet. Verify writes via DevTools. | yes |
| 2 | Hook into `goToHome`, `playRom` swap, `visibilitychange`/`pagehide`. | yes |
| 3 | `formatRelativeTime` util + tests + extend `heroAction`. | yes |
| 4 | UI: HomeHero cold-load Resume, PlayTab switch to autosnap, ContinuePlayingCard badge. | yes |
| 5 | Restart purge wiring + edge-case toasts + schema-mismatch handling. | yes |

Phase 1+2 ship the persistence; user gets resume across reload before any UI polish lands.

---

## Out of scope (v2 ideas)

- Worker-based webp encode (eliminates ~5-10ms hitch).
- Per-frame ring buffer in RAM (zero-hitch snapping).
- Multi-slot autosnap ring (rewind last N).
- Cross-device sync of autosnaps.
- Per-ROM autosnap opt-out.
