import { MemoryMap } from "../../memory/memoryMap";
import { GB_VIDEO_START, GB_VIDEO_BANK_SIZE } from "../../memory/memoryConstants";
import { CgbState } from "../../cgbState";
import { TileCache } from "../../io/video/tileCache";
import { describe, it, assertEquals } from "../framework";
import { setTestRom } from "../cpuTests";

const VBK_ADDR: u16 = 0xFF4F;

function initDmg(): void {
    setTestRom([0x00]);
    // setTestRom calls Emulator.Init which sets isCGB from cartridge (NonCGB rom = false)
}

function initCgb(): void {
    setTestRom([0x00]);
    CgbState.setIsCGB(true);
    CgbState.setVramBank(0);
}

export function testVramBanking(): boolean {
    describe("VBK register (0xFF4F)", () => {

        it("DMG: VBK read returns 0xFF", () => {
            initDmg();
            assertEquals<u8>(MemoryMap.GBload<u8>(VBK_ADDR), 0xFF, "VBK DMG read");
        });

        it("CGB: VBK read bank 0 returns 0xFE", () => {
            initCgb();
            assertEquals<u8>(MemoryMap.GBload<u8>(VBK_ADDR), 0xFE, "VBK bank0 read");
        });

        it("CGB: VBK read bank 1 returns 0xFF", () => {
            initCgb();
            MemoryMap.GBstore<u8>(VBK_ADDR, 1);
            assertEquals<u8>(MemoryMap.GBload<u8>(VBK_ADDR), 0xFF, "VBK bank1 read");
        });

        it("CGB: VBK write selects bank", () => {
            initCgb();
            MemoryMap.GBstore<u8>(VBK_ADDR, 1);
            assertEquals<u32>(CgbState.vramBank, 1, "vramBank == 1");
            MemoryMap.GBstore<u8>(VBK_ADDR, 0);
            assertEquals<u32>(CgbState.vramBank, 0, "vramBank == 0");
        });

        it("CGB: VBK write masks to bit 0 only", () => {
            initCgb();
            MemoryMap.GBstore<u8>(VBK_ADDR, 0xFF);
            assertEquals<u32>(CgbState.vramBank, 1, "only bit 0 used");
        });

        it("DMG: VBK write ignored", () => {
            initDmg();
            MemoryMap.GBstore<u8>(VBK_ADDR, 1);
            assertEquals<u32>(CgbState.vramBank, 0, "DMG vramBank stays 0");
        });
    });

    describe("VRAM banking — GBToMemory", () => {

        it("DMG: 0x8000 maps to GB_VIDEO_START", () => {
            initDmg();
            assertEquals<u32>(MemoryMap.GBToMemory(0x8000), GB_VIDEO_START, "DMG 0x8000 addr");
        });

        it("CGB bank 0: 0x8000 maps to GB_VIDEO_START", () => {
            initCgb();
            assertEquals<u32>(MemoryMap.GBToMemory(0x8000), GB_VIDEO_START, "CGB bank0 addr");
        });

        it("CGB bank 1: 0x8000 maps to GB_VIDEO_START + GB_VIDEO_BANK_SIZE", () => {
            initCgb();
            CgbState.setVramBank(1);
            assertEquals<u32>(MemoryMap.GBToMemory(0x8000), GB_VIDEO_START + GB_VIDEO_BANK_SIZE, "CGB bank1 addr");
        });

        it("CGB bank 0 and 1 hold independent data", () => {
            initCgb();
            CgbState.setVramBank(0);
            MemoryMap.GBstore<u8>(0x8000, 0xAA);
            CgbState.setVramBank(1);
            MemoryMap.GBstore<u8>(0x8000, 0xBB);
            assertEquals<u8>(load<u8>(GB_VIDEO_START), 0xAA, "bank0 data");
            assertEquals<u8>(load<u8>(GB_VIDEO_START + GB_VIDEO_BANK_SIZE), 0xBB, "bank1 data");
        });
    });

    describe("TileCache decode guard", () => {

        it("DMG: tile write updates TileCache", () => {
            initDmg();
            TileCache.Init();
            // Write a simple tile row (lo=0xFF, hi=0x00 => all pixels = 1)
            MemoryMap.GBstore<u8>(0x8000, 0xFF);
            MemoryMap.GBstore<u8>(0x8001, 0x00);
            assertEquals<u8>(unchecked(TileCache.data[0]), 1, "tile pixel decoded");
        });

        it("CGB bank 0: tile write updates TileCache", () => {
            initCgb();
            TileCache.Init();
            CgbState.setVramBank(0);
            MemoryMap.GBstore<u8>(0x8000, 0xFF);
            MemoryMap.GBstore<u8>(0x8001, 0x00);
            assertEquals<u8>(unchecked(TileCache.data[0]), 1, "bank0 tile decoded");
        });

        it("CGB bank 1: tile write does NOT update TileCache", () => {
            initCgb();
            TileCache.Init();
            CgbState.setVramBank(1);
            MemoryMap.GBstore<u8>(0x8000, 0xFF);
            MemoryMap.GBstore<u8>(0x8001, 0x00);
            assertEquals<u8>(unchecked(TileCache.data[0]), 0, "bank1 tile not decoded");
        });
    });

    return true;
}
