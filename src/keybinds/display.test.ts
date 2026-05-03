import { describe, it, expect } from 'vitest';
import { displayBinding } from './display';

describe('displayBinding', () => {
    it('renders letter codes', () => {
        expect(displayBinding({ code: 'KeyR' })).toBe('R');
        expect(displayBinding({ code: 'KeyZ' })).toBe('Z');
    });

    it('renders arrow codes as glyphs', () => {
        expect(displayBinding({ code: 'ArrowUp' })).toBe('↑');
        expect(displayBinding({ code: 'ArrowDown' })).toBe('↓');
        expect(displayBinding({ code: 'ArrowLeft' })).toBe('←');
        expect(displayBinding({ code: 'ArrowRight' })).toBe('→');
    });

    it('renders Space as Space', () => {
        expect(displayBinding({ code: 'Space' })).toBe('Space');
    });

    it('renders Enter as Enter', () => {
        expect(displayBinding({ code: 'Enter' })).toBe('Enter');
    });

    it('renders ShiftLeft as Shift', () => {
        expect(displayBinding({ code: 'ShiftLeft' })).toBe('Shift');
        expect(displayBinding({ code: 'ShiftRight' })).toBe('Shift');
    });

    it('renders digit codes', () => {
        expect(displayBinding({ code: 'Digit1' })).toBe('1');
        expect(displayBinding({ code: 'Digit9' })).toBe('9');
    });

    it('prefixes Shift modifier', () => {
        expect(displayBinding({ code: 'KeyS', shift: true })).toBe('Shift+S');
    });

    it('prefixes Ctrl modifier', () => {
        expect(displayBinding({ code: 'KeyC', ctrl: true })).toBe('Ctrl+C');
    });

    it('prefixes Alt modifier', () => {
        expect(displayBinding({ code: 'KeyA', alt: true })).toBe('Alt+A');
    });

    it('prefixes Meta modifier', () => {
        expect(displayBinding({ code: 'KeyK', meta: true })).toBe('Meta+K');
    });

    it('orders Ctrl Alt Shift Meta when combined', () => {
        expect(displayBinding({ code: 'KeyA', ctrl: true, alt: true, shift: true, meta: true }))
            .toBe('Ctrl+Alt+Shift+Meta+A');
    });

    it('falls back to raw code for unknown', () => {
        expect(displayBinding({ code: 'F5' })).toBe('F5');
        expect(displayBinding({ code: 'Backquote' })).toBe('Backquote');
    });
});
