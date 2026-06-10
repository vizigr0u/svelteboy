import { get } from "svelte/store";
import {
    createSaveState,
    loadSaveState,
    isAtFrameBoundary,
    isCgbMode,
    runOneFrame as backendRunOneFrame,
    getGameFrameView,
    getCgbGameFrameView,
} from "./wasmBridge";
import { stopQueuedAudio } from "./audio";
import { pauseEmulator, runUntilBreak } from "./lifecycle";
import { postRun } from "./loop";
import { saveSlot, loadSlot } from "../saveStateDb";
import { PALETTE_PRESETS, SelectedPaletteIndex } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { DebuggerAttached } from "stores/debugStores";
import { EmulatorPaused, QuickSaveFlyer } from "stores/playStores";
import { showToast } from "stores/toastStore";
import { captureFrameThumbnail, captureCgbFrameThumbnail } from "./snapshotThumbnail";

export async function quickSave(slot: number): Promise<void> {
    const cartridge = get(loadedCartridge);
    if (!cartridge) return;
    if (get(DebuggerAttached)) return;
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
    await saveSlot(cartridge.sha1, slot, { state, thumbnail, savedAt: Date.now() });
    QuickSaveFlyer.set({ thumbnail, key: Date.now() });
    if (wasRunning) runUntilBreak();
}

export async function quickLoad(slot: number): Promise<void> {
    const cartridge = get(loadedCartridge);
    if (!cartridge) return;
    const entry = await loadSlot(cartridge.sha1, slot);
    if (!entry) return;
    const wasRunning = !get(EmulatorPaused);
    pauseEmulator();
    stopQueuedAudio();
    const ok = loadSaveState(entry.state);
    if (!ok) {
        showToast('Save state could not be loaded (mode mismatch or corrupt data).', 'error');
    }
    if (wasRunning) runUntilBreak();
    else if (get(DebuggerAttached)) postRun();
}
