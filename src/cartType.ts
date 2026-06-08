import type { LibraryRomMeta, MbcKind } from './types';

export enum CartType {
    DMG_ONLY = 'dmg',
    MIXED = 'mixed',
    CGB_ONLY = 'cgb',
}

export function mbcKindFromCartType(t: number): MbcKind | undefined {
    if (t === 0x00 || t === 0x08 || t === 0x09) return 'none';
    if (t >= 0x01 && t <= 0x03) return 'mbc1';
    if (t === 0x05 || t === 0x06) return 'mbc2';
    if (t >= 0x0F && t <= 0x13) return 'mbc3';
    if (t >= 0x19 && t <= 0x1E) return 'mbc5';
    return undefined;
}

export function hasBatteryFromCartType(t: number): boolean {
    switch (t) {
        case 0x03: case 0x06: case 0x09: case 0x0D:
        case 0x0F: case 0x10: case 0x13:
        case 0x1B: case 0x1E: case 0x22: case 0xFF:
            return true;
    }
    return false;
}

export function hasRtcFromCartType(t: number): boolean {
    return t === 0x0F || t === 0x10;
}

export function hasRumbleFromCartType(t: number): boolean {
    return t === 0x1C || t === 0x1D || t === 0x1E || t === 0x22;
}

function romSizeBytes(romSizeByte: number): number {
    return 32 * 1024 << romSizeByte;
}

function ramBankCountFromByte(ramSizeByte: number): number {
    switch (ramSizeByte) {
        case 0x02: return 1;
        case 0x03: return 4;
        case 0x04: return 16;
        case 0x05: return 8;
        default: return 0;
    }
}

export function parseCartMeta(buffer: ArrayBuffer): LibraryRomMeta | undefined {
    if (buffer.byteLength < 0x150) return undefined;
    const v = new Uint8Array(buffer, 0, 0x150);
    const cartridgeType = v[0x147];
    const romSizeByte = v[0x148];
    const ramSizeByte = v[0x149];
    const mbcKind = mbcKindFromCartType(cartridgeType);
    const romBankCount = 2 << romSizeByte;
    const romSize = romSizeBytes(romSizeByte);
    const ramBankCount = ramBankCountFromByte(ramSizeByte);
    const ramSize = ramBankCount * 8 * 1024;
    return {
        cartridgeType,
        hasBattery: hasBatteryFromCartType(cartridgeType),
        hasRtc: hasRtcFromCartType(cartridgeType),
        hasRumble: hasRumbleFromCartType(cartridgeType),
        mbcKind,
        romBankCount,
        ramBankCount,
        romSize,
        ramSize,
    };
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
