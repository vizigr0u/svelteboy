import { describe, it, expect } from 'vitest';
import {
    migrateHudConfig,
    applyToggleChip,
    applySetChip,
    applyEnableSpeedrun,
    type HudConfig,
} from './hudStore';

const fresh = (): HudConfig => ({
    enabled: { fps: false, frame: false, input: false, cpu: false, rewind: false },
    position: 'tr',
});

describe('migrateHudConfig', () => {
    it('fills missing chip keys with false', () => {
        const stored = { enabled: { fps: true } as any, position: 'tl' as const };
        const out = migrateHudConfig(stored);
        expect(out.enabled).toEqual({ fps: true, frame: false, input: false, cpu: false, rewind: false });
    });

    it('clamps invalid position to tr', () => {
        const stored = { enabled: fresh().enabled, position: 'xx' as any };
        expect(migrateHudConfig(stored).position).toBe('tr');
    });

    it('preserves valid stored values', () => {
        const stored: HudConfig = {
            enabled: { fps: true, frame: true, input: false, cpu: true, rewind: false },
            position: 'bl',
        };
        expect(migrateHudConfig(stored)).toEqual(stored);
    });
});

describe('applyToggleChip', () => {
    it('flips one chip and leaves others untouched', () => {
        const a = fresh();
        const b = applyToggleChip(a, 'fps');
        expect(b.enabled.fps).toBe(true);
        expect(b.enabled.frame).toBe(false);
        expect(b.enabled.cpu).toBe(false);
        expect(b.position).toBe('tr');
    });
});

describe('applySetChip', () => {
    it('is idempotent when setting same value', () => {
        const a = fresh();
        const b = applySetChip(a, 'fps', true);
        const c = applySetChip(b, 'fps', true);
        expect(c.enabled).toEqual(b.enabled);
    });
});

describe('applyEnableSpeedrun', () => {
    it('sets fps + frame + input true, leaves cpu/rewind untouched', () => {
        const a: HudConfig = {
            enabled: { fps: false, frame: false, input: false, cpu: true, rewind: false },
            position: 'tr',
        };
        const b = applyEnableSpeedrun(a);
        expect(b.enabled.fps).toBe(true);
        expect(b.enabled.frame).toBe(true);
        expect(b.enabled.input).toBe(true);
        expect(b.enabled.cpu).toBe(true);
        expect(b.enabled.rewind).toBe(false);
    });

    it('preserves position', () => {
        const a: HudConfig = { ...fresh(), position: 'bl' };
        expect(applyEnableSpeedrun(a).position).toBe('bl');
    });
});
