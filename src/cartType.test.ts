import { describe, it, expect } from 'vitest';
import { parseCartMeta, mbcKindFromCartType, hasBatteryFromCartType, hasRtcFromCartType, hasRumbleFromCartType } from './cartType';

function makeHeader({
    cartridgeType = 0x00,
    romSizeByte = 0x00,
    ramSizeByte = 0x00,
    cgbFlag = 0x00,
    size = 0x200,
}: {
    cartridgeType?: number;
    romSizeByte?: number;
    ramSizeByte?: number;
    cgbFlag?: number;
    size?: number;
} = {}): ArrayBuffer {
    const buf = new ArrayBuffer(size);
    const v = new Uint8Array(buf);
    v[0x143] = cgbFlag;
    v[0x147] = cartridgeType;
    v[0x148] = romSizeByte;
    v[0x149] = ramSizeByte;
    return buf;
}

describe('cartType — derived helpers', () => {
    it('mbcKindFromCartType maps known types', () => {
        expect(mbcKindFromCartType(0x00)).toBe('none');
        expect(mbcKindFromCartType(0x08)).toBe('none');
        expect(mbcKindFromCartType(0x09)).toBe('none');
        expect(mbcKindFromCartType(0x01)).toBe('mbc1');
        expect(mbcKindFromCartType(0x03)).toBe('mbc1');
        expect(mbcKindFromCartType(0x05)).toBe('mbc2');
        expect(mbcKindFromCartType(0x06)).toBe('mbc2');
        expect(mbcKindFromCartType(0x0F)).toBe('mbc3');
        expect(mbcKindFromCartType(0x10)).toBe('mbc3');
        expect(mbcKindFromCartType(0x13)).toBe('mbc3');
        expect(mbcKindFromCartType(0x19)).toBe('mbc5');
        expect(mbcKindFromCartType(0x1E)).toBe('mbc5');
    });

    it('mbcKindFromCartType returns undefined for unsupported types', () => {
        expect(mbcKindFromCartType(0x0B)).toBeUndefined(); // MMM01
        expect(mbcKindFromCartType(0x20)).toBeUndefined(); // MBC6
        expect(mbcKindFromCartType(0xFE)).toBeUndefined(); // HuC3
    });

    it('hasBatteryFromCartType matches header table', () => {
        expect(hasBatteryFromCartType(0x00)).toBe(false);
        expect(hasBatteryFromCartType(0x03)).toBe(true);  // MBC1+RAM+BATT
        expect(hasBatteryFromCartType(0x06)).toBe(true);  // MBC2+BATT
        expect(hasBatteryFromCartType(0x09)).toBe(true);  // ROM+RAM+BATT
        expect(hasBatteryFromCartType(0x0F)).toBe(true);  // MBC3+TIMER+BATT
        expect(hasBatteryFromCartType(0x10)).toBe(true);  // MBC3+TIMER+RAM+BATT
        expect(hasBatteryFromCartType(0x13)).toBe(true);  // MBC3+RAM+BATT
        expect(hasBatteryFromCartType(0x1B)).toBe(true);  // MBC5+RAM+BATT
        expect(hasBatteryFromCartType(0x1E)).toBe(true);  // MBC5+RUMBLE+RAM+BATT
        expect(hasBatteryFromCartType(0x01)).toBe(false); // MBC1 alone
        expect(hasBatteryFromCartType(0x19)).toBe(false); // MBC5 alone
    });

    it('hasRtcFromCartType true only for MBC3+TIMER variants', () => {
        expect(hasRtcFromCartType(0x0F)).toBe(true);
        expect(hasRtcFromCartType(0x10)).toBe(true);
        expect(hasRtcFromCartType(0x11)).toBe(false);
        expect(hasRtcFromCartType(0x13)).toBe(false);
        expect(hasRtcFromCartType(0x00)).toBe(false);
    });

    it('hasRumbleFromCartType true for MBC5 rumble variants and MBC7', () => {
        expect(hasRumbleFromCartType(0x1C)).toBe(true);
        expect(hasRumbleFromCartType(0x1D)).toBe(true);
        expect(hasRumbleFromCartType(0x1E)).toBe(true);
        expect(hasRumbleFromCartType(0x22)).toBe(true);
        expect(hasRumbleFromCartType(0x19)).toBe(false);
        expect(hasRumbleFromCartType(0x00)).toBe(false);
    });
});

describe('parseCartMeta — header parsing', () => {
    it('returns undefined for buffers smaller than header', () => {
        expect(parseCartMeta(new ArrayBuffer(0x100))).toBeUndefined();
    });

    it('parses ROM-only minimal cart', () => {
        const buf = makeHeader({ cartridgeType: 0x00, romSizeByte: 0x00, ramSizeByte: 0x00 });
        const meta = parseCartMeta(buf);
        expect(meta).toBeDefined();
        expect(meta!.cartridgeType).toBe(0x00);
        expect(meta!.mbcKind).toBe('none');
        expect(meta!.hasBattery).toBe(false);
        expect(meta!.hasRtc).toBe(false);
        expect(meta!.hasRumble).toBe(false);
        expect(meta!.romBankCount).toBe(2);
        expect(meta!.romSize).toBe(32 * 1024);
        expect(meta!.ramBankCount).toBe(0);
        expect(meta!.ramSize).toBe(0);
    });

    it('parses MBC3+RTC+RAM+battery (Pokemon Crystal class)', () => {
        const buf = makeHeader({
            cartridgeType: 0x10,
            romSizeByte: 0x06, // 2 MiB, 128 banks
            ramSizeByte: 0x03, // 32 KiB, 4 banks
        });
        const meta = parseCartMeta(buf)!;
        expect(meta.mbcKind).toBe('mbc3');
        expect(meta.hasRtc).toBe(true);
        expect(meta.hasBattery).toBe(true);
        expect(meta.hasRumble).toBe(false);
        expect(meta.romBankCount).toBe(128);
        expect(meta.romSize).toBe(2 * 1024 * 1024);
        expect(meta.ramBankCount).toBe(4);
        expect(meta.ramSize).toBe(32 * 1024);
    });

    it('parses MBC5 rumble + battery (e.g. Pokemon Pinball)', () => {
        const buf = makeHeader({
            cartridgeType: 0x1E,
            romSizeByte: 0x05, // 1 MiB, 64 banks
            ramSizeByte: 0x02, // 8 KiB, 1 bank
        });
        const meta = parseCartMeta(buf)!;
        expect(meta.mbcKind).toBe('mbc5');
        expect(meta.hasRumble).toBe(true);
        expect(meta.hasBattery).toBe(true);
        expect(meta.romBankCount).toBe(64);
        expect(meta.ramBankCount).toBe(1);
        expect(meta.ramSize).toBe(8 * 1024);
    });

    it('handles unsupported MBC by leaving mbcKind undefined but still parsing sizes', () => {
        const buf = makeHeader({
            cartridgeType: 0xFE, // HuC3
            romSizeByte: 0x02,
            ramSizeByte: 0x03,
        });
        const meta = parseCartMeta(buf)!;
        expect(meta.cartridgeType).toBe(0xFE);
        expect(meta.mbcKind).toBeUndefined();
        expect(meta.romBankCount).toBe(8);
        expect(meta.ramBankCount).toBe(4);
    });
});
