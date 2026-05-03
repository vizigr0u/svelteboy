import type { KeySpec } from "./types";

export const DEFAULT_BINDINGS = {
    gameA:        { code: 'KeyX' },
    gameB:        { code: 'KeyZ' },
    gameSelect:   { code: 'ShiftLeft' },
    gameStart:    { code: 'Enter' },
    gameUp:       { code: 'ArrowUp' },
    gameDown:     { code: 'ArrowDown' },
    gameLeft:     { code: 'ArrowLeft' },
    gameRight:    { code: 'ArrowRight' },
    pause:        { code: 'KeyP' },
    reset:        { code: 'KeyR' },
    screenshot:   { code: 'KeyS', shift: true },
    fastForward:  { code: 'Space' },
} satisfies Record<string, KeySpec>;

export const DEFAULT_SLOT_RANGES = {
    quickLoad: { codePrefix: 'Digit', slotRange: [1, 4] as [number, number] },
    quickSave: { codePrefix: 'Digit', slotRange: [1, 4] as [number, number], shift: true },
};
