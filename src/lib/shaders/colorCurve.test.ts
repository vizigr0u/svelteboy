import { describe, it, expect } from 'vitest';
import { applyCgbColorCurve } from './colorCurve';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('applyCgbColorCurve', () => {
    it('maps black to black', () => {
        const [r, g, b] = applyCgbColorCurve(0, 0, 0);
        expect(r).toBe(0);
        expect(g).toBe(0);
        expect(b).toBe(0);
    });

    it('maps white to white (rows sum to 1)', () => {
        const [r, g, b] = applyCgbColorCurve(1, 1, 1);
        expect(close(r, 1)).toBe(true);
        expect(close(g, 1)).toBe(true);
        expect(close(b, 1)).toBe(true);
    });

    it('desaturates pure red (Gambatte matrix)', () => {
        const [r, g, b] = applyCgbColorCurve(1, 0, 0);
        expect(close(r, 26 / 32)).toBe(true);
        expect(close(g, 0)).toBe(true);
        expect(close(b, 6 / 32)).toBe(true);
    });

    it('desaturates pure green', () => {
        const [r, g, b] = applyCgbColorCurve(0, 1, 0);
        expect(close(r, 4 / 32)).toBe(true);
        expect(close(g, 24 / 32)).toBe(true);
        expect(close(b, 4 / 32)).toBe(true);
    });

    it('desaturates pure blue', () => {
        const [r, g, b] = applyCgbColorCurve(0, 0, 1);
        expect(close(r, 2 / 32)).toBe(true);
        expect(close(g, 8 / 32)).toBe(true);
        expect(close(b, 22 / 32)).toBe(true);
    });

    it('clamps output to [0,1]', () => {
        const out = applyCgbColorCurve(2, -1, 0.5);
        for (const c of out) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(1);
        }
    });

    it('is energy-preserving on grayscale (input = output)', () => {
        for (const v of [0.1, 0.25, 0.5, 0.75]) {
            const [r, g, b] = applyCgbColorCurve(v, v, v);
            expect(close(r, v)).toBe(true);
            expect(close(g, v)).toBe(true);
            expect(close(b, v)).toBe(true);
        }
    });
});
