import { describe, it, assertEquals } from "../framework";
import { Ppu, PpuOamFifo } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_OAM_START, GB_VIDEO_START } from "../../memory/memoryConstants";
import { initPpu } from "./ppuTestHelpers";

// ── helpers ─────────────────────────────────────────────────────────────────

function setOamEntry(index: u8, yPos: u8, xPos: u8, tileIndex: u8, flags: u8): void {
    const base = GB_OAM_START + <u32>index * 4;
    store<u8>(base + 0, yPos);
    store<u8>(base + 1, xPos);
    store<u8>(base + 2, tileIndex);
    store<u8>(base + 3, flags);
}

// Solid tile via GBstore (updates tile decode cache)
function setTileSolid(tileIndex: u8, colorId: u8): void {
    const lo: u8 = (colorId & 1) != 0 ? 0xFF : 0x00;
    const hi: u8 = (colorId & 2) != 0 ? 0xFF : 0x00;
    const gbBase: u16 = <u16>(0x8000 + <u32>tileIndex * 16);
    for (let row: u8 = 0; row < 8; row++) {
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     lo);
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), hi);
    }
}

function getPixel(x: u32, y: u32 = 0): u8 {
    return load<u8>(Ppu.workingBufferPtr + y * 160 + x);
}

// LCDC 0x91 = PPU(7) + TILE_8000(4) + BG(0)
function setupBG(bgp: u8): void {
    initPpu();
    MemoryMap.GBstore<u8>(0xFF40, 0x91);
    MemoryMap.GBstore<u8>(0xFF47, bgp);
}

// LCDC 0x82 = PPU(7) + OBJ(1)  — no BG
function setupSprite(obp0: u8, obp1: u8): void {
    initPpu();
    MemoryMap.GBstore<u8>(0xFF40, 0x82);
    MemoryMap.GBstore<u8>(0xFF47, 0xE4); // BGP identity (unused, no BG)
    MemoryMap.GBstore<u8>(0xFF48, obp0);
    MemoryMap.GBstore<u8>(0xFF49, obp1);
}

// LCDC 0x93 = PPU(7) + TILE_8000(4) + OBJ(1) + BG(0)
function setupBGAndSprite(bgp: u8, obp0: u8): void {
    initPpu();
    MemoryMap.GBstore<u8>(0xFF40, 0x93);
    MemoryMap.GBstore<u8>(0xFF47, bgp);
    MemoryMap.GBstore<u8>(0xFF48, obp0);
    MemoryMap.GBstore<u8>(0xFF49, 0xE4);
}

function renderLine(ly: u8 = 0): void {
    Lcd.setLY(ly);
    PpuOamFifo.FetchCurrentLine();
    ScanlineRenderer.Render();
}

// ── tests ────────────────────────────────────────────────────────────────────

export function testPalettes(): boolean {

    // ── BGP: individual bit-pair mappings ────────────────────────────────────
    describe("BGP register bit layout", () => {

        it("bits 1-0 control colorId 0 shade", () => {
            // BGP=0x03: bits1-0=11 → colorId 0 → shade 3
            setupBG(0x03);
            setTileSolid(0, 0); // all pixels colorId 0
            store<u8>(GB_VIDEO_START + 0x1800, 0);
            ScanlineRenderer.Render();
            assertEquals<u8>(getPixel(0), 3, "BGP=0x03: colorId 0 → shade 3");
        });

        it("bits 3-2 control colorId 1 shade", () => {
            // BGP=0x0C: bits3-2=11 → colorId 1 → shade 3
            setupBG(0x0C);
            setTileSolid(0, 1);
            store<u8>(GB_VIDEO_START + 0x1800, 0);
            ScanlineRenderer.Render();
            assertEquals<u8>(getPixel(0), 3, "BGP=0x0C: colorId 1 → shade 3");
        });

        it("bits 5-4 control colorId 2 shade", () => {
            // BGP=0x30: bits5-4=11 → colorId 2 → shade 3
            setupBG(0x30);
            setTileSolid(0, 2);
            store<u8>(GB_VIDEO_START + 0x1800, 0);
            ScanlineRenderer.Render();
            assertEquals<u8>(getPixel(0), 3, "BGP=0x30: colorId 2 → shade 3");
        });

        it("bits 7-6 control colorId 3 shade", () => {
            // BGP=0xC0: bits7-6=11 → colorId 3 → shade 3
            setupBG(0xC0);
            setTileSolid(0, 3);
            store<u8>(GB_VIDEO_START + 0x1800, 0);
            ScanlineRenderer.Render();
            assertEquals<u8>(getPixel(0), 3, "BGP=0xC0: colorId 3 → shade 3");
        });

        it("all-zero BGP maps all colorIds to shade 0", () => {
            setupBG(0x00);
            for (let cid: u8 = 0; cid < 4; cid++) {
                setTileSolid(cid, cid);
                store<u8>(GB_VIDEO_START + 0x1800 + <u32>cid, cid); // map col cid → tile cid
            }
            ScanlineRenderer.Render();
            for (let x: u32 = 0; x < 32; x++) {
                assertEquals<u8>(getPixel(x), 0, "BGP=0x00: all shades → 0");
            }
        });
    });

    // ── OBP0: full per-color-id mapping ──────────────────────────────────────
    describe("OBP0 register bit layout", () => {

        it("bits 3-2 control colorId 1 shade", () => {
            // OBP0=0x0C: bits3-2=11 → colorId 1 → shade 3
            setupSprite(0x0C, 0xE4);
            setTileSolid(0, 1);
            setOamEntry(0, 16, 8, 0, 0x00); // OBP0
            renderLine(0);
            assertEquals<u8>(getPixel(0), 3, "OBP0=0x0C: colorId 1 → shade 3");
        });

        it("bits 5-4 control colorId 2 shade", () => {
            // OBP0=0x20: bits5-4=10 → colorId 2 → shade 2
            setupSprite(0x20, 0xE4);
            setTileSolid(0, 2);
            setOamEntry(0, 16, 8, 0, 0x00);
            renderLine(0);
            assertEquals<u8>(getPixel(0), 2, "OBP0=0x20: colorId 2 → shade 2");
        });

        it("bits 7-6 control colorId 3 shade", () => {
            // OBP0=0x40: bits7-6=01 → colorId 3 → shade 1
            setupSprite(0x40, 0xE4);
            setTileSolid(0, 3);
            setOamEntry(0, 16, 8, 0, 0x00);
            renderLine(0);
            assertEquals<u8>(getPixel(0), 1, "OBP0=0x40: colorId 3 → shade 1");
        });

        it("bits 1-0 ignored: colorId 0 transparent even when bits1-0=11", () => {
            // OBP0=0xFF: bits1-0=11 would map colorId 0 → shade 3, but colorId 0 is always transparent
            // BG tile 1 fills colorId 2 so transparent sprite reveals BG
            setupBGAndSprite(0xE4, 0xFF);
            setTileSolid(1, 2); // BG tile 1 → colorId 2
            store<u8>(GB_VIDEO_START + 0x1800, 1); // map[0,0] → tile 1
            setTileSolid(0, 0); // sprite tile 0 → all colorId 0 (transparent)
            setOamEntry(0, 16, 8, 0, 0x00); // OBP0
            renderLine(0);
            // transparent sprite: BG colorId 2 shows through (identity BGP → shade 2)
            assertEquals<u8>(getPixel(0), 2, "OBP0 bits1-0=11: colorId 0 still transparent, BG shows");
        });
    });

    // ── OBP1: full per-color-id mapping ──────────────────────────────────────
    describe("OBP1 register bit layout", () => {

        it("bits 3-2 control colorId 1 shade", () => {
            // OBP1=0x08: bits3-2=10 → colorId 1 → shade 2
            setupSprite(0xE4, 0x08);
            setTileSolid(0, 1);
            setOamEntry(0, 16, 8, 0, 0x10); // OBP1 (bit4=1)
            renderLine(0);
            assertEquals<u8>(getPixel(0), 2, "OBP1=0x08: colorId 1 → shade 2");
        });

        it("bits 5-4 control colorId 2 shade", () => {
            // OBP1=0x30: bits5-4=11 → colorId 2 → shade 3
            setupSprite(0xE4, 0x30);
            setTileSolid(0, 2);
            setOamEntry(0, 16, 8, 0, 0x10);
            renderLine(0);
            assertEquals<u8>(getPixel(0), 3, "OBP1=0x30: colorId 2 → shade 3");
        });

        it("bits 7-6 control colorId 3 shade", () => {
            // OBP1=0x80: bits7-6=10 → colorId 3 → shade 2
            setupSprite(0xE4, 0x80);
            setTileSolid(0, 3);
            setOamEntry(0, 16, 8, 0, 0x10);
            renderLine(0);
            assertEquals<u8>(getPixel(0), 2, "OBP1=0x80: colorId 3 → shade 2");
        });

        it("bits 1-0 ignored: colorId 0 transparent even when bits1-0=11", () => {
            // OBP1=0xFF via OBP0=0xE4 and OBP1=0xFF
            setupBGAndSprite(0xE4, 0xE4);
            MemoryMap.GBstore<u8>(0xFF49, 0xFF); // OBP1 override
            setTileSolid(1, 2); // BG tile 1 → colorId 2
            store<u8>(GB_VIDEO_START + 0x1800, 1);
            setTileSolid(0, 0); // sprite tile 0 → all colorId 0
            setOamEntry(0, 16, 8, 0, 0x10); // OBP1
            renderLine(0);
            assertEquals<u8>(getPixel(0), 2, "OBP1 bits1-0=11: colorId 0 still transparent, BG shows");
        });
    });

    return true;
}
