import { get, writable } from "svelte/store";
import { pauseEmulator, runUntilBreak } from "../emulator/lifecycle";
import { EmulatorPaused, EmulatorInitialized } from "./playStores";
import { DebuggerAttached } from "./debugStores";
import { onboardingDismissed, dismissOnboarding } from "./onboardingStore";

// Central state hub for the Play chrome + settings drawer (YouTube-player model).
// Replaces the retired tab-overlay model (overlayStore).

export type DrawerTab = "general" | "game";

export const CHROME_AUTOHIDE_MS = 1800;

export const chromeVisible = writable<boolean>(false);
export const drawerOpen = writable<boolean>(false);
export const drawerTab = writable<DrawerTab>("general");

let hideTimer: ReturnType<typeof setTimeout> | null = null;

function clearHideTimer(): void {
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
}

// Schedule chrome auto-hide. No-op while paused (stable anchor) or first-run
// (sticky chrome stays until the user's first interaction; see markInteracted).
export function hideChromeSoon(): void {
    clearHideTimer();
    if (get(EmulatorPaused)) return;
    if (!get(onboardingDismissed)) return;
    hideTimer = setTimeout(() => {
        chromeVisible.set(false);
        hideTimer = null;
    }, CHROME_AUTOHIDE_MS);
}

// First real user gesture retires the sticky first-run chrome + onboarding card.
export function markInteracted(): void {
    if (!get(onboardingDismissed)) {
        dismissOnboarding();
        hideChromeSoon();
    }
}

// Show chrome and (re)arm the auto-hide timer.
export function revealChrome(): void {
    chromeVisible.set(true);
    hideChromeSoon();
}

export function hideChrome(): void {
    clearHideTimer();
    chromeVisible.set(false);
}

// Center Big Pause. Paused -> chrome stays; running -> resume + fade chrome.
export function togglePause(): void {
    if (get(DebuggerAttached)) return;
    markInteracted();
    if (get(EmulatorPaused)) {
        runUntilBreak();
        hideChromeSoon();
    } else {
        if (!get(EmulatorInitialized)) return;
        pauseEmulator();
        clearHideTimer();
        chromeVisible.set(true);
    }
}

// Drawer keeps the game running (live preview). Two deep-links: cog -> general, game-settings -> game.
// Chrome hides while the drawer is open (buttons would move/clip; not needed in settings).
export function openDrawer(tab: DrawerTab = "general"): void {
    markInteracted();
    drawerTab.set(tab);
    drawerOpen.set(true);
    hideChrome();
}

export function closeDrawer(): void {
    drawerOpen.set(false);
}

// Play view registers its fullscreen toggle so drawer/chrome actions can trigger it.
let fullscreenToggle: (() => void) | null = null;
export function registerFullscreenToggle(fn: (() => void) | null): void {
    fullscreenToggle = fn;
}
export function requestFullscreenToggle(): void {
    fullscreenToggle?.();
}
