import { describe, it, expect } from 'vitest';
import { decideSnap, type SnapGateInputs, type SnapReason } from './autoSnapGate';

const baseRunning: SnapGateInputs = {
    hasCart: true,
    paused: false,
    debuggerAttached: false,
    autoSnapEnabled: true,
    framesAdvancedSinceLast: true,
    msSinceLastSnap: 60_000,
};

describe('decideSnap', () => {
    it('snaps when all gates pass on interval', () => {
        expect(decideSnap('interval', baseRunning)).toEqual({ snap: true });
    });

    it.each<SnapReason>(['interval', 'exit', 'swap', 'hidden'])(
        'skips with no-cart for reason %s',
        (reason) => {
            expect(decideSnap(reason, { ...baseRunning, hasCart: false }))
                .toEqual({ snap: false, skipBecause: 'no-cart' });
        }
    );

    it.each<SnapReason>(['interval', 'exit', 'swap', 'hidden'])(
        'skips with option-off for reason %s',
        (reason) => {
            expect(decideSnap(reason, { ...baseRunning, autoSnapEnabled: false }))
                .toEqual({ snap: false, skipBecause: 'option-off' });
        }
    );

    it.each<SnapReason>(['interval', 'exit', 'swap', 'hidden'])(
        'skips with debugger for reason %s',
        (reason) => {
            expect(decideSnap(reason, { ...baseRunning, debuggerAttached: true }))
                .toEqual({ snap: false, skipBecause: 'debugger' });
        }
    );

    it.each<SnapReason>(['interval', 'exit', 'swap', 'hidden'])(
        'skips with paused for reason %s',
        (reason) => {
            expect(decideSnap(reason, { ...baseRunning, paused: true }))
                .toEqual({ snap: false, skipBecause: 'paused' });
        }
    );

    it.each<SnapReason>(['interval', 'exit', 'swap', 'hidden'])(
        'skips with no-frames for reason %s when frames not advanced',
        (reason) => {
            expect(decideSnap(reason, { ...baseRunning, framesAdvancedSinceLast: false }))
                .toEqual({ snap: false, skipBecause: 'no-frames' });
        }
    );

    it('debounces interval snaps inside 10s window', () => {
        expect(decideSnap('interval', { ...baseRunning, msSinceLastSnap: 5_000 }))
            .toEqual({ snap: false, skipBecause: 'debounce' });
    });

    it('debounces interval snaps at the 9999ms boundary', () => {
        expect(decideSnap('interval', { ...baseRunning, msSinceLastSnap: 9_999 }))
            .toEqual({ snap: false, skipBecause: 'debounce' });
    });

    it('snaps interval at exactly 10s', () => {
        expect(decideSnap('interval', { ...baseRunning, msSinceLastSnap: 10_000 }))
            .toEqual({ snap: true });
    });

    it.each<SnapReason>(['exit', 'swap', 'hidden'])(
        'reason %s ignores debounce window',
        (reason) => {
            expect(decideSnap(reason, { ...baseRunning, msSinceLastSnap: 1_000 }))
                .toEqual({ snap: true });
        }
    );

    it('gate priority: no-cart wins over option-off', () => {
        expect(decideSnap('interval', { ...baseRunning, hasCart: false, autoSnapEnabled: false }))
            .toEqual({ snap: false, skipBecause: 'no-cart' });
    });

    it('gate priority: option-off wins over debugger', () => {
        expect(decideSnap('interval', { ...baseRunning, autoSnapEnabled: false, debuggerAttached: true }))
            .toEqual({ snap: false, skipBecause: 'option-off' });
    });
});
