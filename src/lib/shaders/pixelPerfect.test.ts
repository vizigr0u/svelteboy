import { describe, it, expect } from 'vitest';
import { pixelPerfectScale } from './pixelPerfect';

const W = 160, H = 144;

describe('pixelPerfectScale', () => {
    it('returns 1 when container exactly matches base', () => {
        expect(pixelPerfectScale(W, H)).toBe(1);
    });

    it('returns 2 at 2× exact', () => {
        expect(pixelPerfectScale(W * 2, H * 2)).toBe(2);
    });

    it('rounds down on non-integer multiple', () => {
        expect(pixelPerfectScale(W * 2 + 5, H * 2 + 5)).toBe(2);
        expect(pixelPerfectScale(W * 3 - 1, H * 3 - 1)).toBe(2);
    });

    it('uses smaller axis (height-limited)', () => {
        expect(pixelPerfectScale(W * 5, H * 2)).toBe(2);
    });

    it('uses smaller axis (width-limited)', () => {
        expect(pixelPerfectScale(W * 2, H * 5)).toBe(2);
    });

    it('clamps to minimum 1 when container too small', () => {
        expect(pixelPerfectScale(50, 50)).toBe(1);
        expect(pixelPerfectScale(0, 0)).toBe(1);
    });

    it('handles fractional container sizes (rAF/devicePixelRatio)', () => {
        expect(pixelPerfectScale(W * 3 + 0.5, H * 3 + 0.5)).toBe(3);
    });

    it('respects custom base resolution', () => {
        expect(pixelPerfectScale(800, 600, 100, 100)).toBe(6);
    });
});
