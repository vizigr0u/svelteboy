import { get, writable } from "svelte/store";
import { pauseEmulator, runUntilBreak } from "../emulator/lifecycle";
import { EmulatorInitialized, EmulatorPaused } from "./playStores";
import { DebuggerAttached } from "./debugStores";

export type OverlayTab = "now" | "library" | "options";

export const overlayOpen = writable<boolean>(false);
export const overlayTab = writable<OverlayTab>("now");

// Remember whether the emulator was running when the overlay opened, so we
// only resume on close if we were the ones who paused it.
let pausedByOverlay = false;

export function openOverlay(tab: OverlayTab = "now"): void {
    overlayTab.set(tab);
    if (get(overlayOpen)) return;
    overlayOpen.set(true);
    if (get(EmulatorInitialized) && !get(EmulatorPaused) && !get(DebuggerAttached)) {
        pausedByOverlay = true;
        pauseEmulator();
    }
}

export function closeOverlay(): void {
    if (!get(overlayOpen)) return;
    overlayOpen.set(false);
    if (pausedByOverlay) {
        pausedByOverlay = false;
        runUntilBreak();
    }
}

export function toggleOverlay(tab: OverlayTab = "now"): void {
    if (get(overlayOpen)) closeOverlay();
    else openOverlay(tab);
}

// Play view registers its fullscreen toggle so overlay action rows can trigger it.
let fullscreenToggle: (() => void) | null = null;
export function registerFullscreenToggle(fn: (() => void) | null): void {
    fullscreenToggle = fn;
}
export function requestFullscreenToggle(): void {
    fullscreenToggle?.();
}
