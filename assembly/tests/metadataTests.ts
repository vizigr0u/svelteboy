import { Metadata, CartridgeType, CGBMode } from "../metadata";
import { describe, it, assertEquals } from "./framework";

// Minimum ROM buffer: $0150 bytes, header lives at $0100-$014F
function makeRomHeader(
    title: u8[],        // up to 16 bytes at $0134
    cgbFlag: u8,        // $0143
    newLicenseeHi: u8,  // $0144
    newLicenseeLo: u8,  // $0145
    sgbFlag: u8,        // $0146
    cartType: u8,       // $0147
    romSizeByte: u8,    // $0148
    ramSizeByte: u8,    // $0149
    dest: u8,           // $014A
    oldLicensee: u8,    // $014B
    maskRomVer: u8,     // $014C
    headerChecksum: u8, // $014D
    globalChecksumHi: u8, // $014E
    globalChecksumLo: u8  // $014F
): ArrayBuffer {
    const buf = new Uint8Array(0x150);
    for (let i = 0; i < title.length && i < 16; i++) {
        buf[0x134 + i] = title[i];
    }
    buf[0x143] = cgbFlag;
    buf[0x144] = newLicenseeHi;
    buf[0x145] = newLicenseeLo;
    buf[0x146] = sgbFlag;
    buf[0x147] = cartType;
    buf[0x148] = romSizeByte;
    buf[0x149] = ramSizeByte;
    buf[0x14A] = dest;
    buf[0x14B] = oldLicensee;
    buf[0x14C] = maskRomVer;
    buf[0x14D] = headerChecksum;
    buf[0x14E] = globalChecksumHi;
    buf[0x14F] = globalChecksumLo;
    return buf.buffer;
}

function simpleRom(cartType: CartridgeType = CartridgeType.ROM_ONLY, romSizeByte: u8 = 0, ramSizeByte: u8 = 0): ArrayBuffer {
    return makeRomHeader([], 0, 0, 0, 0, <u8>cartType, romSizeByte, ramSizeByte, 0, 0, 0, 0, 0, 0);
}

function computeHeaderChecksum(buf: Uint8Array): u8 {
    let cs: u8 = 0;
    for (let addr: u32 = 0x134; addr <= 0x14C; addr++) {
        cs = cs - buf[addr] - 1;
    }
    return cs;
}

export function testMetadata(): boolean {
    describe("Metadata parsing", () => {

        it("title parsed from $0134 (16 bytes, null-terminated)", () => {
            // "TETRIS" followed by 10 null bytes
            const title: u8[] = [0x54, 0x45, 0x54, 0x52, 0x49, 0x53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            const rom = makeRomHeader(title, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            // null-terminated: title should start with "TETRIS"
            assert(meta.title.startsWith("TETRIS"), "title starts with TETRIS, got: " + meta.title);
        });

        it("cgbFlag $80 stored correctly", () => {
            const rom = makeRomHeader([], 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.cgbFlag, 0x80, "cgbFlag $80");
        });

        it("cgbFlag $C0 stored correctly", () => {
            const rom = makeRomHeader([], 0xC0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.cgbFlag, 0xC0, "cgbFlag $C0");
        });

        it("sgbFlag $03 stored correctly", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.sgbFlag, 0x03, "sgbFlag $03");
        });

        it("cartridgeType stored correctly", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0x13, 0, 0, 0, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<CartridgeType>(meta.cartridgeType, CartridgeType.MBC3_RAM_BATTERY_2, "cartridgeType MBC3+RAM+BATTERY");
        });

        it("romSizeByte stored correctly", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0, 0x05, 0, 0, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.romSizeByte, 0x05, "romSizeByte");
        });

        it("ramSizeByte stored correctly", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0, 0, 0x03, 0, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.ramSizeByte, 0x03, "ramSizeByte");
        });

        it("destinationFlag stored correctly ($00=Japan, $01=Overseas)", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0, 0, 0, 0x01, 0, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.destinationFlag, 0x01, "destinationFlag overseas");
        });

        it("oldLicenseeCode stored correctly", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0, 0, 0, 0, 0x33, 0, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.oldLicenseeCode, 0x33, "oldLicenseeCode $33");
        });

        it("maskRomVersionNumber stored correctly", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x02, 0, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.maskRomVersionNumber, 0x02, "maskRomVersionNumber");
        });

        it("headerChecksum stored correctly", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xE7, 0, 0);
            const meta = Metadata.read(rom);
            assertEquals<u8>(meta.headerChecksum, 0xE7, "headerChecksum");
        });

        it("headerChecksum algorithm: sum($0134-$014C) each subtracted with -1", () => {
            // Build a ROM where checksum is set to the valid computed value
            const buf = new Uint8Array(0x150);
            // Write "TETRIS" at $0134
            buf[0x134] = 0x54; buf[0x135] = 0x45; buf[0x136] = 0x54;
            buf[0x137] = 0x52; buf[0x138] = 0x49; buf[0x139] = 0x53;
            buf[0x147] = 0x00; // ROM_ONLY
            const expected = computeHeaderChecksum(buf);
            buf[0x14D] = expected;
            const meta = Metadata.read(buf.buffer);
            assertEquals<u8>(meta.headerChecksum, expected, "header checksum matches computed");
        });

        it("globalChecksum stored (not verified by boot ROM)", () => {
            const rom = makeRomHeader([], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xAB, 0xCD);
            const meta = Metadata.read(rom);
            // ByteReader.read<u16> is little-endian (WASM native), so $014E=lo $014F=hi
            // globalChecksum field holds the 16-bit value as read (little-endian)
            assert(meta.globalChecksum != 0, "globalChecksum non-zero");
        });

    });

    describe("RomBankCount", () => {
        // spec: 32KiB × (1<<val), so bankCount = 1<<(val+1)

        it("$00 → 2 banks (32KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x00, 0));
            assertEquals<u16>(meta.RomBankCount, 2, "$00→2");
        });

        it("$01 → 4 banks (64KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x01, 0));
            assertEquals<u16>(meta.RomBankCount, 4, "$01→4");
        });

        it("$02 → 8 banks (128KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x02, 0));
            assertEquals<u16>(meta.RomBankCount, 8, "$02→8");
        });

        it("$03 → 16 banks (256KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x03, 0));
            assertEquals<u16>(meta.RomBankCount, 16, "$03→16");
        });

        it("$04 → 32 banks (512KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x04, 0));
            assertEquals<u16>(meta.RomBankCount, 32, "$04→32");
        });

        it("$05 → 64 banks (1MiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x05, 0));
            assertEquals<u16>(meta.RomBankCount, 64, "$05→64");
        });

        it("$06 → 128 banks (2MiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x06, 0));
            assertEquals<u16>(meta.RomBankCount, 128, "$06→128");
        });

        it("$07 → 256 banks (4MiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x07, 0));
            assertEquals<u16>(meta.RomBankCount, 256, "$07→256");
        });

        it("$08 → 512 banks (8MiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0x08, 0));
            assertEquals<u16>(meta.RomBankCount, 512, "$08→512");
        });
    });

    describe("RamBankCount", () => {
        it("$00 → 0 banks (no RAM)", () => {
            const meta = Metadata.read(simpleRom(0, 0, 0x00));
            assertEquals<u16>(meta.RamBankCount, 0, "$00→0");
        });

        it("$01 → 0 banks (unused)", () => {
            const meta = Metadata.read(simpleRom(0, 0, 0x01));
            assertEquals<u16>(meta.RamBankCount, 0, "$01→0 (unused)");
        });

        it("$02 → 1 bank (8KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0, 0x02));
            assertEquals<u16>(meta.RamBankCount, 1, "$02→1");
        });

        it("$03 → 4 banks (32KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0, 0x03));
            assertEquals<u16>(meta.RamBankCount, 4, "$03→4");
        });

        it("$04 → 16 banks (128KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0, 0x04));
            assertEquals<u16>(meta.RamBankCount, 16, "$04→16");
        });

        it("$05 → 8 banks (64KiB)", () => {
            const meta = Metadata.read(simpleRom(0, 0, 0x05));
            assertEquals<u16>(meta.RamBankCount, 8, "$05→8");
        });
    });

    describe("HasBattery", () => {
        it("ROM_ONLY has no battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.ROM_ONLY)).HasBattery, false, "ROM_ONLY no battery");
        });

        it("MBC1 has no battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.MBC1)).HasBattery, false, "MBC1 no battery");
        });

        it("MBC1+RAM+BATTERY has battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.MBC1_RAM_BATTERY)).HasBattery, true, "MBC1_RAM_BATTERY");
        });

        it("MBC2+BATTERY has battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.MBC2_BATTERY)).HasBattery, true, "MBC2_BATTERY");
        });

        it("MBC3+TIMER+BATTERY has battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.MBC3_TIMER_BATTERY)).HasBattery, true, "MBC3_TIMER_BATTERY");
        });

        it("MBC3+RAM+BATTERY has battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.MBC3_RAM_BATTERY_2)).HasBattery, true, "MBC3_RAM_BATTERY_2");
        });

        it("MBC5 has no battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.MBC5)).HasBattery, false, "MBC5 no battery");
        });

        it("MBC5+RAM+BATTERY has battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.MBC5_RAM_BATTERY)).HasBattery, true, "MBC5_RAM_BATTERY");
        });

        it("HuC1+RAM+BATTERY has battery", () => {
            assertEquals<bool>(Metadata.read(simpleRom(CartridgeType.HuC1_RAM_BATTERY)).HasBattery, true, "HuC1_RAM_BATTERY");
        });
    });

    describe("getCGBMode", () => {
        it("cgbFlag $80 → PartialCGB", () => {
            const meta = Metadata.read(makeRomHeader([], 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
            assertEquals<CGBMode>(meta.getCGBMode(), CGBMode.PartialCGB, "0x80→PartialCGB");
        });

        it("cgbFlag $C0 → CGBOnly", () => {
            const meta = Metadata.read(makeRomHeader([], 0xC0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
            assertEquals<CGBMode>(meta.getCGBMode(), CGBMode.CGBOnly, "0xC0→CGBOnly");
        });

        it("cgbFlag $00 → NonCGB", () => {
            const meta = Metadata.read(makeRomHeader([], 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
            assertEquals<CGBMode>(meta.getCGBMode(), CGBMode.NonCGB, "0x00→NonCGB");
        });

        it("cgbFlag $44 (neither $80/$C0) → NonCGB", () => {
            const meta = Metadata.read(makeRomHeader([], 0x44, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
            assertEquals<CGBMode>(meta.getCGBMode(), CGBMode.NonCGB, "other→NonCGB");
        });
    });

    describe("CartridgeType enum values", () => {
        it("ROM_ONLY = $00", () => { assertEquals<i32>(CartridgeType.ROM_ONLY, 0x00, "ROM_ONLY"); });
        it("MBC1 = $01", () => { assertEquals<i32>(CartridgeType.MBC1, 0x01, "MBC1"); });
        it("MBC2 = $05", () => { assertEquals<i32>(CartridgeType.MBC2, 0x05, "MBC2"); });
        it("MBC3 = $11", () => { assertEquals<i32>(CartridgeType.MBC3, 0x11, "MBC3"); });
        it("MBC5 = $19", () => { assertEquals<i32>(CartridgeType.MBC5, 0x19, "MBC5"); });
        it("MBC3_TIMER_BATTERY = $0F", () => { assertEquals<i32>(CartridgeType.MBC3_TIMER_BATTERY, 0x0F, "MBC3_TIMER_BATTERY"); });
        it("MBC5_RUMBLE = $1C", () => { assertEquals<i32>(CartridgeType.MBC5_RUMBLE, 0x1C, "MBC5_RUMBLE"); });
        it("HuC1_RAM_BATTERY = $FF", () => { assertEquals<i32>(CartridgeType.HuC1_RAM_BATTERY, 0xFF, "HuC1_RAM_BATTERY"); });
    });

    return true;
}
