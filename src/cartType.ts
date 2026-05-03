export enum CartType {
    DMG_ONLY = 'dmg',
    MIXED = 'mixed',
    CGB_ONLY = 'cgb',
}

export function cartTypeFromCgbFlag(cgbFlag: number | undefined): CartType {
    if (cgbFlag === 0xC0) return CartType.CGB_ONLY;
    if (cgbFlag === 0x80) return CartType.MIXED;
    return CartType.DMG_ONLY;
}

export function cartTypeLabel(t: CartType): string {
    switch (t) {
        case CartType.DMG_ONLY: return 'GB';
        case CartType.MIXED: return 'GB/CGB';
        case CartType.CGB_ONLY: return 'CGB';
    }
}

export type RenderModeOverride = 'auto' | 'force-gb' | 'force-cgb';
export type ResolvedRenderMode = 'gb' | 'cgb';

export function resolveRenderMode(
    cart: CartType,
    perRom: RenderModeOverride | undefined,
    globalDefault: RenderModeOverride,
): ResolvedRenderMode {
    const eff: RenderModeOverride = perRom ?? globalDefault ?? 'auto';
    if (eff === 'force-gb') return 'gb';
    if (eff === 'force-cgb') return 'cgb';
    return cart === CartType.DMG_ONLY ? 'gb' : 'cgb';
}
