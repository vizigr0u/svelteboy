import { describe, it, expect } from 'vitest';
import { matchBinding, slotFromCode } from './match';
import type { KeySpec, RangeKeySpec } from './types';

function ev(code: string, mods: Partial<{ shift: boolean; ctrl: boolean; meta: boolean; alt: boolean }> = {}): KeyboardEvent {
    return {
        code,
        shiftKey: !!mods.shift,
        ctrlKey: !!mods.ctrl,
        metaKey: !!mods.meta,
        altKey: !!mods.alt,
    } as unknown as KeyboardEvent;
}

describe('matchBinding (KeySpec)', () => {
    it('matches code with no modifiers required and none pressed', () => {
        const b: KeySpec = { code: 'KeyR' };
        expect(matchBinding(ev('KeyR'), b)).toBe(true);
    });

    it('rejects different code', () => {
        const b: KeySpec = { code: 'KeyR' };
        expect(matchBinding(ev('KeyS'), b)).toBe(false);
    });

    it('rejects when modifier pressed but binding requires absent', () => {
        const b: KeySpec = { code: 'KeyR' };
        expect(matchBinding(ev('KeyR', { shift: true }), b)).toBe(false);
        expect(matchBinding(ev('KeyR', { ctrl: true }), b)).toBe(false);
        expect(matchBinding(ev('KeyR', { meta: true }), b)).toBe(false);
        expect(matchBinding(ev('KeyR', { alt: true }), b)).toBe(false);
    });

    it('matches when required modifier is pressed', () => {
        const b: KeySpec = { code: 'KeyS', shift: true };
        expect(matchBinding(ev('KeyS', { shift: true }), b)).toBe(true);
    });

    it('rejects when required modifier missing', () => {
        const b: KeySpec = { code: 'KeyS', shift: true };
        expect(matchBinding(ev('KeyS'), b)).toBe(false);
    });

    it('rejects when extra modifier pressed beyond required', () => {
        const b: KeySpec = { code: 'KeyS', shift: true };
        expect(matchBinding(ev('KeyS', { shift: true, ctrl: true }), b)).toBe(false);
    });

    it('treats shift:false as required-not-pressed', () => {
        const b: KeySpec = { code: 'KeyS', shift: false };
        expect(matchBinding(ev('KeyS'), b)).toBe(true);
        expect(matchBinding(ev('KeyS', { shift: true }), b)).toBe(false);
    });

    it('handles all four modifiers strict', () => {
        const b: KeySpec = { code: 'KeyA', ctrl: true, alt: true };
        expect(matchBinding(ev('KeyA', { ctrl: true, alt: true }), b)).toBe(true);
        expect(matchBinding(ev('KeyA', { ctrl: true }), b)).toBe(false);
        expect(matchBinding(ev('KeyA', { ctrl: true, alt: true, shift: true }), b)).toBe(false);
    });
});

describe('matchBinding (RangeKeySpec)', () => {
    it('matches a code in range with no modifiers', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4] };
        expect(matchBinding(ev('Digit2'), b)).toBe(true);
    });

    it('rejects code outside range', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4] };
        expect(matchBinding(ev('Digit5'), b)).toBe(false);
        expect(matchBinding(ev('Digit0'), b)).toBe(false);
    });

    it('rejects code without prefix', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4] };
        expect(matchBinding(ev('KeyA'), b)).toBe(false);
    });

    it('respects shift modifier requirement', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4], shift: true };
        expect(matchBinding(ev('Digit3', { shift: true }), b)).toBe(true);
        expect(matchBinding(ev('Digit3'), b)).toBe(false);
    });

    it('rejects extra modifier on range', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4] };
        expect(matchBinding(ev('Digit2', { ctrl: true }), b)).toBe(false);
    });
});

describe('slotFromCode', () => {
    it('returns digit when in range', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4] };
        expect(slotFromCode(ev('Digit3'), b)).toBe(3);
    });

    it('returns null when out of range', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4] };
        expect(slotFromCode(ev('Digit7'), b)).toBeNull();
    });

    it('returns null when modifiers mismatch', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4], shift: true };
        expect(slotFromCode(ev('Digit2'), b)).toBeNull();
    });

    it('returns digit with required shift', () => {
        const b: RangeKeySpec = { codePrefix: 'Digit', slotRange: [1, 4], shift: true };
        expect(slotFromCode(ev('Digit2', { shift: true }), b)).toBe(2);
    });
});
