export type SnapReason = 'interval' | 'exit' | 'swap' | 'hidden';

export type SnapSkipReason =
    | 'no-cart'
    | 'option-off'
    | 'debugger'
    | 'paused'
    | 'no-frames'
    | 'debounce';

export type SnapDecision =
    | { snap: true }
    | { snap: false; skipBecause: SnapSkipReason };

export type SnapGateInputs = {
    hasCart: boolean;
    paused: boolean;
    debuggerAttached: boolean;
    autoSnapEnabled: boolean;
    framesAdvancedSinceLast: boolean;
    msSinceLastSnap: number;
};

export const SNAP_DEBOUNCE_MS = 10_000;

export function decideSnap(reason: SnapReason, inputs: SnapGateInputs): SnapDecision {
    if (!inputs.hasCart) return { snap: false, skipBecause: 'no-cart' };
    if (!inputs.autoSnapEnabled) return { snap: false, skipBecause: 'option-off' };
    if (inputs.debuggerAttached) return { snap: false, skipBecause: 'debugger' };
    if (inputs.paused) return { snap: false, skipBecause: 'paused' };
    if (!inputs.framesAdvancedSinceLast) return { snap: false, skipBecause: 'no-frames' };
    if (reason === 'interval' && inputs.msSinceLastSnap < SNAP_DEBOUNCE_MS)
        return { snap: false, skipBecause: 'debounce' };
    return { snap: true };
}
