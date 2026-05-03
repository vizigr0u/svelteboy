import type { KeySpec, RangeKeySpec } from "./types";

function isRange(b: KeySpec | RangeKeySpec): b is RangeKeySpec {
    return (b as RangeKeySpec).codePrefix !== undefined;
}

function modifiersMatch(e: KeyboardEvent, b: { shift?: boolean; ctrl?: boolean; meta?: boolean; alt?: boolean }): boolean {
    return e.shiftKey === !!b.shift
        && e.ctrlKey === !!b.ctrl
        && e.metaKey === !!b.meta
        && e.altKey === !!b.alt;
}

export function matchBinding(e: KeyboardEvent, b: KeySpec | RangeKeySpec): boolean {
    if (isRange(b)) {
        if (!e.code.startsWith(b.codePrefix)) return false;
        const n = parseInt(e.code.slice(b.codePrefix.length), 10);
        if (Number.isNaN(n) || n < b.slotRange[0] || n > b.slotRange[1]) return false;
        return modifiersMatch(e, b);
    }
    if (e.code !== b.code) return false;
    return modifiersMatch(e, b);
}

export function slotFromCode(e: KeyboardEvent, b: RangeKeySpec): number | null {
    if (!matchBinding(e, b)) return null;
    return parseInt(e.code.slice(b.codePrefix.length), 10);
}
