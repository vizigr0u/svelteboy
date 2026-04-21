import type { KeyBindings } from "./types";

export type AbPreset = { label: string; a: string; b: string };
export type DpadPreset = { label: string; up: string; down: string; left: string; right: string };

export const AB_PRESETS: AbPreset[] = [
    { label: 'X / Z', a: 'x', b: 'z' },
    { label: 'Z / X', a: 'z', b: 'x' },
    { label: 'A / S', a: 'a', b: 's' },
    { label: 'S / A', a: 's', b: 'a' },
    { label: 'K / L', a: 'k', b: 'l' },
    { label: 'L / K', a: 'l', b: 'k' },
];

export const SELECT_PRESETS: string[] = ['Shift', 'Backspace'];

export const DPAD_PRESETS: DpadPreset[] = [
    { label: 'Arrows', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    { label: 'WASD',   up: 'w',       down: 's',         left: 'a',         right: 'd' },
    { label: 'ZSQD',   up: 'z',       down: 's',         left: 'q',         right: 'd' },
];

export const DEFAULT_KEYBINDINGS: KeyBindings = {
    a: 'x', b: 'z', select: 'Shift',
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};

export function displayKey(key: string): string {
    switch (key) {
        case 'ArrowUp':    return '↑';
        case 'ArrowDown':  return '↓';
        case 'ArrowLeft':  return '←';
        case 'ArrowRight': return '→';
        default: return key.length === 1 ? key.toUpperCase() : key;
    }
}

function keyRole(key: string, bindings: KeyBindings): string {
    if (key === bindings.up)     return 'D-pad ↑';
    if (key === bindings.down)   return 'D-pad ↓';
    if (key === bindings.left)   return 'D-pad ←';
    if (key === bindings.right)  return 'D-pad →';
    if (key === bindings.select) return 'Select';
    if (key === bindings.a)      return 'A';
    if (key === bindings.b)      return 'B';
    return displayKey(key);
}

export function abConflictReason(preset: AbPreset, bindings: KeyBindings): string | null {
    const occupied = new Set([bindings.up, bindings.down, bindings.left, bindings.right, bindings.select]);
    const parts: string[] = [];
    if (occupied.has(preset.a)) parts.push(`${displayKey(preset.a)} used by ${keyRole(preset.a, bindings)}`);
    if (occupied.has(preset.b)) parts.push(`${displayKey(preset.b)} used by ${keyRole(preset.b, bindings)}`);
    return parts.length ? parts.join('; ') : null;
}

export function selectConflictReason(key: string, bindings: KeyBindings): string | null {
    const occupied = new Set([bindings.up, bindings.down, bindings.left, bindings.right, bindings.a, bindings.b]);
    if (!occupied.has(key)) return null;
    return `${displayKey(key)} already used by ${keyRole(key, bindings)}`;
}

export function dpadConflictReason(preset: DpadPreset, bindings: KeyBindings): string | null {
    const occupied = new Set([bindings.a, bindings.b, bindings.select]);
    const parts: string[] = [];
    for (const key of [preset.up, preset.down, preset.left, preset.right]) {
        if (occupied.has(key)) parts.push(`${displayKey(key)} used by ${keyRole(key, bindings)}`);
    }
    return parts.length ? parts.join('; ') : null;
}

export function matchesAbPreset(bindings: KeyBindings, preset: AbPreset): boolean {
    return bindings.a === preset.a && bindings.b === preset.b;
}

export function matchesDpadPreset(bindings: KeyBindings, preset: DpadPreset): boolean {
    return bindings.up === preset.up && bindings.down === preset.down &&
           bindings.left === preset.left && bindings.right === preset.right;
}
