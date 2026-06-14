import { describe, it, expect, vi } from 'vitest';

vi.mock('../emulator', () => ({ Emulator: {}, Debug: {} }));
vi.mock('../emulator/lifecycle', () => ({ pauseEmulator: () => {}, unPauseEmulator: () => {} }));
vi.mock('../stores/viewStore', async () => {
    const { writable } = await import('svelte/store');
    return { goToHome: () => {}, goToPlay: () => {}, playViewActive: writable(false) };
});
vi.mock('../stores/romStores', async () => {
    const { writable } = await import('svelte/store');
    return { loadedCartridge: writable(null), loadedBootRom: writable(null) };
});
vi.mock('../stores/playStores', async () => {
    const { writable } = await import('svelte/store');
    return { EmulatorPaused: writable(false), FastForwardActive: writable(false) };
});
vi.mock('../stores/overlayStore', () => ({ openOverlay: () => {} }));
vi.mock('../stores/optionsStore', async () => {
    const { writable } = await import('svelte/store');
    return { showFrametimeHistogram: writable(false) };
});
vi.mock('../stores/debugStores', async () => {
    const { writable } = await import('svelte/store');
    return { DebuggerAttached: writable(false) };
});
vi.mock('../stores/paletteStore', async () => {
    const { writable } = await import('svelte/store');
    return { debugUnlocked: writable(false) };
});
vi.mock('../stores/hudStore', () => ({
    toggleHudChip: () => {}, enableSpeedrunHud: () => {},
}));

const { fuzzyScore } = await import('./commands');

describe('fuzzyScore', () => {
    it('returns 0 for empty query', () => {
        expect(fuzzyScore('', 'anything')).toBe(0);
    });

    it('returns -1 on miss', () => {
        expect(fuzzyScore('xyz', 'abc')).toBe(-1);
    });

    it('matches contiguous subsequence', () => {
        expect(fuzzyScore('abc', 'abcdef')).toBeGreaterThan(0);
    });

    it('exact contiguous match scores higher than scattered subsequence', () => {
        const contiguous = fuzzyScore('abc', 'abcdef');
        const scattered = fuzzyScore('abc', 'axbxc');
        expect(contiguous).toBeGreaterThan(scattered);
    });

    it('streak rewards contiguous over gapped', () => {
        // same chars, same first-position, only difference is contiguity
        const tight = fuzzyScore('abc', 'abcxx');
        const loose = fuzzyScore('abc', 'axbxc');
        expect(tight).toBeGreaterThan(loose);
    });

    it('is case-insensitive', () => {
        expect(fuzzyScore('ABC', 'abcdef')).toBe(fuzzyScore('abc', 'ABCDEF'));
    });

    it('boundary-start match boosts score', () => {
        // "o" at boundary in "open" vs mid-word in "reopen"
        expect(fuzzyScore('o', 'open')).toBeGreaterThan(fuzzyScore('o', 'reopen'));
    });

    it('treats space as boundary', () => {
        // both 't' match, "test thing" mid has prev space (boundary), no offset is also boundary
        const startBoundary = fuzzyScore('t', 'test');
        const spaceBoundary = fuzzyScore('t', 'a test');
        const midMatch = fuzzyScore('t', 'attest');
        expect(startBoundary).toBeGreaterThan(midMatch);
        expect(spaceBoundary).toBeGreaterThan(midMatch);
    });

    it('treats slash as boundary', () => {
        expect(fuzzyScore('b', 'a/b')).toBeGreaterThan(fuzzyScore('b', 'aab'));
    });

    it('earlier first-match wins on otherwise equal score', () => {
        // "a" matches at index 0 (boundary) in "a" — score = 16 - 0 = 16
        // "a" matches at index 1 (prev space, boundary) in " a" — score = 16 - 1 = 15
        expect(fuzzyScore('a', 'a')).toBeGreaterThan(fuzzyScore('a', ' a'));
    });
});
