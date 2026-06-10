import { get } from "svelte/store";
import {
    createSaveState,
    isAtFrameBoundary,
    isCgbMode,
    runOneFrame as backendRunOneFrame,
    getGameFrameView,
    getCgbGameFrameView,
} from "./wasmBridge";
import { pauseEmulator, runUntilBreak } from "./lifecycle";
import { saveAuto, deleteAuto } from "../saveStateDb";
import { captureFrameThumbnail, captureCgbFrameThumbnail } from "./snapshotThumbnail";
import { PALETTE_PRESETS, SelectedPaletteIndex, AutoSnapEnabled } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { DebuggerAttached } from "stores/debugStores";
import { EmulatorPaused, GameFrames } from "stores/playStores";
import { decideSnap, type SnapReason } from "./autoSnapGate";

const TICK_MS = 30_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let snapInFlight = false;
let lastSnapAt = 0;
let lastSnapFrameCount = -1;

export function startAutoSnapScheduler(): void {
    if (intervalHandle !== null) return;
    intervalHandle = setInterval(() => { void snapNow('interval'); }, TICK_MS);
}

export function stopAutoSnapScheduler(): void {
    if (intervalHandle !== null) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
}

export async function snapNow(reason: SnapReason): Promise<void> {
    if (snapInFlight) return;
    const cart = get(loadedCartridge);
    const currentFrames = get(GameFrames);
    const decision = decideSnap(reason, {
        hasCart: !!cart,
        paused: get(EmulatorPaused),
        debuggerAttached: get(DebuggerAttached),
        autoSnapEnabled: get(AutoSnapEnabled),
        framesAdvancedSinceLast: currentFrames !== lastSnapFrameCount,
        msSinceLastSnap: Date.now() - lastSnapAt,
    });
    if (!decision.snap || !cart) return;

    snapInFlight = true;
    try {
        const wasRunning = !get(EmulatorPaused);
        pauseEmulator();
        if (!isAtFrameBoundary()) backendRunOneFrame();
        const state = createSaveState();
        if (state.byteLength === 0) {
            if (wasRunning) runUntilBreak();
            return;
        }
        const thumbnail = isCgbMode()
            ? captureCgbFrameThumbnail(getCgbGameFrameView())
            : captureFrameThumbnail(getGameFrameView(), PALETTE_PRESETS[get(SelectedPaletteIndex)]);
        await saveAuto(cart.sha1, { state, thumbnail, savedAt: Date.now() });
        lastSnapAt = Date.now();
        lastSnapFrameCount = currentFrames;
        if (wasRunning) runUntilBreak();
    } catch (err) {
        console.warn('autosnap failed:', err);
    } finally {
        snapInFlight = false;
    }
}

export async function purgeAutoForCurrentRom(): Promise<void> {
    const cart = get(loadedCartridge);
    if (!cart) return;
    await deleteAuto(cart.sha1).catch(err => console.warn('autosnap purge failed:', err));
    lastSnapFrameCount = -1;
    lastSnapAt = 0;
}

export async function purgeAutoFor(sha1: string): Promise<void> {
    await deleteAuto(sha1).catch(err => console.warn('autosnap purge failed:', err));
    const cart = get(loadedCartridge);
    if (cart && cart.sha1 === sha1) {
        lastSnapFrameCount = -1;
        lastSnapAt = 0;
    }
}

export function resetAutoSnapTracking(): void {
    lastSnapFrameCount = -1;
    lastSnapAt = 0;
}
