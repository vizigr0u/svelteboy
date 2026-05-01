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
import { saveSlot, loadSlot } from "../saveStateDb";
import { PALETTE_PRESETS, SelectedPaletteIndex, type GBPalette } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { DebuggerAttached } from "stores/debugStores";
import { EmulatorPaused } from "stores/playStores";

function encodeThumbnail(data: Uint8ClampedArray): string {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 144;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(160, 144);
    imageData.data.set(data);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/webp', 0.7);
}

function captureFrameThumbnail(frame: Uint8Array, palette: GBPalette): string {
    const data = new Uint8ClampedArray(160 * 144 * 4);
    for (let i = 0; i < 160 * 144; i++) {
        const c = palette[frame[i] & 3];
        data[i * 4 + 0] = c & 0xff;
        data[i * 4 + 1] = (c >> 8) & 0xff;
        data[i * 4 + 2] = (c >> 16) & 0xff;
        data[i * 4 + 3] = 255;
    }
    return encodeThumbnail(data);
}

function captureCgbFrameThumbnail(frame: Uint16Array): string {
    const data = new Uint8ClampedArray(160 * 144 * 4);
    for (let i = 0; i < 160 * 144; i++) {
        const rgb = frame[i];
        data[i * 4 + 0] = ((rgb & 31) * 255 / 31) | 0;
        data[i * 4 + 1] = (((rgb >> 5) & 31) * 255 / 31) | 0;
        data[i * 4 + 2] = (((rgb >> 10) & 31) * 255 / 31) | 0;
        data[i * 4 + 3] = 255;
    }
    return encodeThumbnail(data);
}

export async function quickSave(slot: number): Promise<void> {
    const cartridge = get(loadedCartridge);
    if (!cartridge) return;
    if (get(DebuggerAttached)) return;
    const wasRunning = !get(EmulatorPaused);
    pauseEmulator();
    if (!await isAtFrameBoundary()) await backendRunOneFrame();
    const state = await createSaveState();
    if (state.byteLength === 0) {
        if (wasRunning) runUntilBreak();
        return;
    }
    const thumbnail = await isCgbMode()
        ? captureCgbFrameThumbnail(getCgbGameFrameView())
        : captureFrameThumbnail(getGameFrameView(), PALETTE_PRESETS[get(SelectedPaletteIndex)]);
    await saveSlot(cartridge.sha1, slot, { state, thumbnail, savedAt: Date.now() });
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
    await loadSaveState(entry.state);
    if (wasRunning && !get(DebuggerAttached)) runUntilBreak();
}
