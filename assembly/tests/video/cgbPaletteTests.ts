import { MemoryMap } from "../../memory/memoryMap";
import { CgbState } from "../../cgbState";
import { Lcd } from "../../io/video/lcd";
import { GB_CGB_PALETTE_RAM_START } from "../../memory/memoryConstants";
import { describe, it, assertEquals } from "../framework";
import { setTestRom } from "../cpuTests";

const BCPS: u16 = 0xFF68;
const BCPD: u16 = 0xFF69;
const OCPS: u16 = 0xFF6A;
const OCPD: u16 = 0xFF6B;

function initCgb(): void {
    setTestRom([0x00]);
    CgbState.setIsCGB(true);
}

function initDmg(): void {
    setTestRom([0x00]);
    // setTestRom → Emulator.Init → isCGB = false for NonCGB rom
}

export function testCgbPalettes(): boolean {
    describe("BCPS / BCPD — BG palette registers", () => {

        it("BCPS write stores index + auto-increment bit", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 0x80 | 5);
            assertEquals<u8>(MemoryMap.GBload<u8>(BCPS), 0xC0 | 5, "bit6=1, bit7=1, idx=5");
        });

        it("BCPS bit 6 always reads as 1", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 0x00);
            assertEquals<u8>(MemoryMap.GBload<u8>(BCPS) & 0x40, 0x40, "bit6 always 1");
        });

        it("BCPD write stores byte at palette RAM index", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 3);
            MemoryMap.GBstore<u8>(BCPD, 0xAB);
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 3), 0xAB, "byte at index 3");
        });

        it("BCPD read returns byte at palette RAM index", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 7);
            MemoryMap.GBstore<u8>(BCPD, 0xCD);
            MemoryMap.GBstore<u8>(BCPS, 7);
            assertEquals<u8>(MemoryMap.GBload<u8>(BCPD), 0xCD, "read back at index 7");
        });

        it("BCPD auto-increment advances index", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 0x80 | 2); // auto-inc, start at 2
            MemoryMap.GBstore<u8>(BCPD, 0x11);
            MemoryMap.GBstore<u8>(BCPD, 0x22);
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 2), 0x11, "idx 2");
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 3), 0x22, "idx 3 after increment");
        });

        it("BCPD auto-increment wraps at 64", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 0x80 | 63); // auto-inc, start at 63
            MemoryMap.GBstore<u8>(BCPD, 0xFF);
            // index should wrap to 0, auto-inc bit preserved
            assertEquals<u8>(MemoryMap.GBload<u8>(BCPS) & 0x3F, 0, "wrapped to 0");
            assertEquals<u8>(MemoryMap.GBload<u8>(BCPS) & 0x80, 0x80, "auto-inc bit preserved");
        });

        it("BCPD no auto-increment stays at same index", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 5); // no auto-inc
            MemoryMap.GBstore<u8>(BCPD, 0xAA);
            MemoryMap.GBstore<u8>(BCPD, 0xBB);
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 5), 0xBB, "second write overwrites idx 5");
        });
    });

    describe("OCPS / OCPD — OBJ palette registers", () => {

        it("OCPD write stores byte at OBJ palette RAM offset", () => {
            initCgb();
            MemoryMap.GBstore<u8>(OCPS, 4);
            MemoryMap.GBstore<u8>(OCPD, 0x55);
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 64 + 4), 0x55, "OBJ byte at offset 64+4");
        });

        it("OCPD auto-increment advances OBJ index", () => {
            initCgb();
            MemoryMap.GBstore<u8>(OCPS, 0x80 | 0);
            MemoryMap.GBstore<u8>(OCPD, 0x12);
            MemoryMap.GBstore<u8>(OCPD, 0x34);
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 64 + 0), 0x12, "OBJ idx 0");
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 64 + 1), 0x34, "OBJ idx 1");
        });

        it("BG and OBJ palette RAM are isolated", () => {
            initCgb();
            MemoryMap.GBstore<u8>(BCPS, 0);
            MemoryMap.GBstore<u8>(BCPD, 0xAA);
            MemoryMap.GBstore<u8>(OCPS, 0);
            MemoryMap.GBstore<u8>(OCPD, 0xBB);
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 0), 0xAA, "BG[0] = 0xAA");
            assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 64), 0xBB, "OBJ[0] = 0xBB");
        });
    });

    describe("getCGBBgColor / getCGBObjColor helpers", () => {

        it("getCGBBgColor reads RGB555 word from BG palette", () => {
            initCgb();
            // palette 1, color 2 → offset = 1*8 + 2*2 = 12
            store<u16>(GB_CGB_PALETTE_RAM_START + 12, 0x7FFF);
            assertEquals<u16>(Lcd.getCGBBgColor(1, 2), 0x7FFF, "BG palette1 color2");
        });

        it("getCGBObjColor reads RGB555 word from OBJ palette", () => {
            initCgb();
            // palette 0, color 3 → offset = 0*8 + 3*2 = 6; OBJ base = 64
            store<u16>(GB_CGB_PALETTE_RAM_START + 64 + 6, 0x1234);
            assertEquals<u16>(Lcd.getCGBObjColor(0, 3), 0x1234, "OBJ palette0 color3");
        });

        it("getCGBBgColor palette 7 color 3 uses correct offset", () => {
            initCgb();
            // offset = 7*8 + 3*2 = 62
            store<u16>(GB_CGB_PALETTE_RAM_START + 62, 0x03E0);
            assertEquals<u16>(Lcd.getCGBBgColor(7, 3), 0x03E0, "BG palette7 color3");
        });
    });

    describe("DMG mode ignores CGB palette registers", () => {

        it("DMG: BCPS not handled", () => {
            initDmg();
            assertEquals<boolean>(Lcd.Handles(BCPS), false, "DMG BCPS not handled");
        });

        it("DMG: OCPS not handled", () => {
            initDmg();
            assertEquals<boolean>(Lcd.Handles(OCPS), false, "DMG OCPS not handled");
        });
    });

    describe("Lcd.Init post-boot palette contract (CGB mode)", () => {

        it("BG palette RAM initialized to white (RGB555 0x7FFF) in CGB mode", () => {
            setTestRom([0x00]);
            CgbState.setIsCGB(true);
            Lcd.Init();
            for (let i: u32 = 0; i < 64; i += 2) {
                assertEquals<u16>(load<u16>(GB_CGB_PALETTE_RAM_START + i), 0x7FFF,
                    "BG palette entry white at offset " + i.toString());
            }
        });

        it("getCGBBgColor returns white for all BG palette entries after Init", () => {
            setTestRom([0x00]);
            CgbState.setIsCGB(true);
            Lcd.Init();
            for (let p: u8 = 0; p < 8; p++) {
                for (let c: u8 = 0; c < 4; c++) {
                    assertEquals<u16>(Lcd.getCGBBgColor(p, c), 0x7FFF,
                        "BG palette " + p.toString() + " color " + c.toString());
                }
            }
        });

        it("OBJ palette RAM zeroed in CGB mode (uninit per spec, safe default)", () => {
            setTestRom([0x00]);
            CgbState.setIsCGB(true);
            Lcd.Init();
            for (let i: u32 = 64; i < 128; i += 2) {
                assertEquals<u16>(load<u16>(GB_CGB_PALETTE_RAM_START + i), 0,
                    "OBJ palette entry zeroed at offset " + i.toString());
            }
        });

        it("DMG mode: full palette RAM zeroed (unused region)", () => {
            setTestRom([0x00]);
            CgbState.setIsCGB(false);
            Lcd.Init();
            for (let i: u32 = 0; i < 128; i += 2) {
                assertEquals<u16>(load<u16>(GB_CGB_PALETTE_RAM_START + i), 0,
                    "palette entry zeroed at offset " + i.toString());
            }
        });
    });

    return true;
}
