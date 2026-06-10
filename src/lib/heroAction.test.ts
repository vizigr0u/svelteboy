import { describe, it, expect } from 'vitest';
import { resolveHeroAction } from './heroAction';

describe('resolveHeroAction', () => {
    it('returns resume when hero matches loaded cart and emulator initialized', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: 'abc',
            emulatorInitialized: true,
            hasAutoSnap: false,
        })).toBe('resume');
    });

    it('returns play when hero matches loaded cart but emulator not initialized', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: 'abc',
            emulatorInitialized: false,
            hasAutoSnap: false,
        })).toBe('play');
    });

    it('returns play when hero differs from loaded cart', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: 'def',
            emulatorInitialized: true,
            hasAutoSnap: false,
        })).toBe('play');
    });

    it('returns play when no cart is loaded', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: undefined,
            emulatorInitialized: false,
            hasAutoSnap: false,
        })).toBe('play');
    });

    it('returns play when no cart is loaded even if init flag stale-true', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: undefined,
            emulatorInitialized: true,
            hasAutoSnap: false,
        })).toBe('play');
    });

    it('returns resume on cold load when autosnap exists for hero rom', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: undefined,
            emulatorInitialized: false,
            hasAutoSnap: true,
        })).toBe('resume');
    });

    it('returns resume when different rom loaded but hero has autosnap', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: 'def',
            emulatorInitialized: true,
            hasAutoSnap: true,
        })).toBe('resume');
    });

    it('live session wins: returns resume when hero matches loaded (even if autosnap absent)', () => {
        expect(resolveHeroAction({
            heroSha1: 'abc',
            loadedSha1: 'abc',
            emulatorInitialized: true,
            hasAutoSnap: false,
        })).toBe('resume');
    });
});

describe('resolveHeroAction — header-pill redundancy', () => {
    it('pillRedundantWhenHeroVisible: true when hero matches loaded', () => {
        expect(resolveHeroAction.pillRedundantWhenHeroVisible({
            heroSha1: 'abc',
            loadedSha1: 'abc',
        })).toBe(true);
    });

    it('pillRedundantWhenHeroVisible: false when hero differs', () => {
        expect(resolveHeroAction.pillRedundantWhenHeroVisible({
            heroSha1: 'abc',
            loadedSha1: 'def',
        })).toBe(false);
    });

    it('pillRedundantWhenHeroVisible: false when no cart loaded', () => {
        expect(resolveHeroAction.pillRedundantWhenHeroVisible({
            heroSha1: 'abc',
            loadedSha1: undefined,
        })).toBe(false);
    });

    it('pillRedundantWhenHeroVisible: false when no hero', () => {
        expect(resolveHeroAction.pillRedundantWhenHeroVisible({
            heroSha1: undefined,
            loadedSha1: 'abc',
        })).toBe(false);
    });
});
