import type { DEFAULT_BINDINGS } from "./defaults";

export interface KeySpec {
    code: string;
    shift?: boolean;
    ctrl?: boolean;
    meta?: boolean;
    alt?: boolean;
}

export interface RangeKeySpec extends Omit<KeySpec, 'code'> {
    codePrefix: string;
    slotRange: [number, number];
}

export type BindingId = keyof typeof DEFAULT_BINDINGS;
export type Bindings = Record<BindingId, KeySpec>;

export interface KeybindPreset {
    id: string;
    label: string;
    category: 'game' | 'system' | 'all';
    bindings: Partial<Bindings>;
}
