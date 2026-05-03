import type { KeySpec } from "./types";

function codeLabel(code: string): string {
    switch (code) {
        case 'ArrowUp':    return '↑';
        case 'ArrowDown':  return '↓';
        case 'ArrowLeft':  return '←';
        case 'ArrowRight': return '→';
        case 'ShiftLeft':
        case 'ShiftRight': return 'Shift';
        case 'ControlLeft':
        case 'ControlRight': return 'Ctrl';
        case 'AltLeft':
        case 'AltRight': return 'Alt';
        case 'MetaLeft':
        case 'MetaRight': return 'Meta';
        case 'Space':   return 'Space';
        case 'Enter':   return 'Enter';
        case 'Tab':     return 'Tab';
        case 'Escape':  return 'Esc';
        case 'Backspace': return 'Backspace';
    }
    if (code.startsWith('Key') && code.length === 4)   return code.slice(3);
    if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
    return code;
}

export function displayBinding(b: KeySpec): string {
    const parts: string[] = [];
    if (b.ctrl)  parts.push('Ctrl');
    if (b.alt)   parts.push('Alt');
    if (b.shift) parts.push('Shift');
    if (b.meta)  parts.push('Meta');
    parts.push(codeLabel(b.code));
    return parts.join('+');
}
