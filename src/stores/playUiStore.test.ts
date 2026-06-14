import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, writable } from 'svelte/store';

const { EmulatorPaused, EmulatorInitialized, DebuggerAttached, onboardingDismissed, dismissOnboarding, pauseEmulator, runUntilBreak } = vi.hoisted(() => {
    const { writable } = require('svelte/store');
    const EmulatorPaused = writable(false);
    const onboardingDismissed = writable(true);
    return {
        EmulatorPaused,
        EmulatorInitialized: writable(true),
        DebuggerAttached: writable(false),
        onboardingDismissed,
        dismissOnboarding: vi.fn(() => onboardingDismissed.set(true)),
        pauseEmulator: vi.fn(() => EmulatorPaused.set(true)),
        runUntilBreak: vi.fn(() => EmulatorPaused.set(false)),
    };
});

vi.mock('../emulator/lifecycle', () => ({
    pauseEmulator: () => pauseEmulator(),
    runUntilBreak: () => runUntilBreak(),
}));
vi.mock('./playStores', () => ({ EmulatorPaused, EmulatorInitialized }));
vi.mock('./debugStores', () => ({ DebuggerAttached }));
vi.mock('./onboardingStore', () => ({ onboardingDismissed, dismissOnboarding: () => dismissOnboarding() }));

import {
    chromeVisible, drawerOpen, drawerTab,
    revealChrome, hideChromeSoon, togglePause, openDrawer, closeDrawer, markInteracted,
    CHROME_AUTOHIDE_MS,
} from './playUiStore';

beforeEach(() => {
    vi.useFakeTimers();
    EmulatorPaused.set(false);
    EmulatorInitialized.set(true);
    DebuggerAttached.set(false);
    onboardingDismissed.set(true);
    pauseEmulator.mockClear();
    runUntilBreak.mockClear();
    dismissOnboarding.mockClear();
    chromeVisible.set(false);
    drawerOpen.set(false);
    drawerTab.set('general');
});

describe('chrome reveal / auto-hide', () => {
    it('revealChrome shows chrome then auto-hides after timeout', () => {
        revealChrome();
        expect(get(chromeVisible)).toBe(true);
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS - 1);
        expect(get(chromeVisible)).toBe(true);
        vi.advanceTimersByTime(1);
        expect(get(chromeVisible)).toBe(false);
    });

    it('chrome stays visible while paused (no auto-hide)', () => {
        EmulatorPaused.set(true);
        revealChrome();
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS * 2);
        expect(get(chromeVisible)).toBe(true);
    });

    it('repeated reveal resets the hide timer', () => {
        revealChrome();
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS - 100);
        revealChrome();
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS - 100);
        expect(get(chromeVisible)).toBe(true);
        vi.advanceTimersByTime(100);
        expect(get(chromeVisible)).toBe(false);
    });
});

describe('togglePause', () => {
    it('pauses a running emulator and keeps chrome visible', () => {
        revealChrome();
        togglePause();
        expect(pauseEmulator).toHaveBeenCalledOnce();
        expect(get(EmulatorPaused)).toBe(true);
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS * 2);
        expect(get(chromeVisible)).toBe(true);
    });

    it('resumes a paused emulator and schedules chrome hide', () => {
        EmulatorPaused.set(true);
        revealChrome();
        togglePause();
        expect(runUntilBreak).toHaveBeenCalledOnce();
        expect(get(EmulatorPaused)).toBe(false);
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS);
        expect(get(chromeVisible)).toBe(false);
    });
});

describe('first-run sticky chrome', () => {
    it('chrome stays visible until first interaction when onboarding not dismissed', () => {
        onboardingDismissed.set(false);
        revealChrome();
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS * 2);
        expect(get(chromeVisible)).toBe(true);
    });

    it('markInteracted dismisses onboarding and re-arms auto-hide', () => {
        onboardingDismissed.set(false);
        revealChrome();
        markInteracted();
        expect(dismissOnboarding).toHaveBeenCalledOnce();
        vi.advanceTimersByTime(CHROME_AUTOHIDE_MS);
        expect(get(chromeVisible)).toBe(false);
    });
});

describe('drawer', () => {
    it('openDrawer sets tab and opens without pausing', () => {
        openDrawer('game');
        expect(get(drawerOpen)).toBe(true);
        expect(get(drawerTab)).toBe('game');
        expect(pauseEmulator).not.toHaveBeenCalled();
    });

    it('openDrawer defaults to general tab', () => {
        openDrawer();
        expect(get(drawerTab)).toBe('general');
    });

    it('openDrawer hides chrome', () => {
        revealChrome();
        openDrawer('game');
        expect(get(chromeVisible)).toBe(false);
    });

    it('closeDrawer closes the drawer', () => {
        openDrawer('game');
        closeDrawer();
        expect(get(drawerOpen)).toBe(false);
    });
});
