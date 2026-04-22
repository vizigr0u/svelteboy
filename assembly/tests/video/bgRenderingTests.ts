import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { Ppu } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { describe, it, assertEquals } from "../framework";
import { initPpu } from "./ppuTestHelpers";
import { GB_VIDEO_START } from "../../memory/memoryConstants";

// WASM-side addresses for VRAM regions (GB $8000 = WASM 0x0000)
const TILE_BLOCK0: u32 = GB_VIDEO_START;            // GB $8000 - block 0 (LCDC.4=1 unsigned base)
const TILE_BLOCK1: u32 = GB_VIDEO_START + 0x0800;   // GB $8800 - block 1
const TILE_BLOCK2: u32 = GB_VIDEO_START + 0x1000;   // GB $9000 - block 2 (LCDC.4=0 signed index 0)
const MAP_9800: u32    = GB_VIDEO_START + 0x1800;   // GB $9800 tile map
const MAP_9C00: u32    = GB_VIDEO_START + 0x1C00;   // GB $9C00 tile map

// LCDC presets (bit7=PPU, bit4=tile$8000, bit3=map$9C00, bit1=OBJ, bit0=BG)
const LCDC_BG_OBJ:     u8 = 0x93; // 1001 0011  PPU|TILE_8000|OBJ|BG
const LCDC_BG_ONLY:    u8 = 0x91; // 1001 0001  PPU|TILE_8000|BG  (no OBJ)
const LCDC_BG_OBJ_HI:  u8 = 0x9B; // 1001 1011  PPU|TILE_8000|MAP9C00|OBJ|BG
const LCDC_BG_OBJ_8800: u8 = 0x83; // 1000 0011  PPU|OBJ|BG (LCDC.4=0 → $8800 signed mode)

// BGP identity: colorId → colorId  (11 10 01 00 = 0xE4)
const BGP_IDENTITY: u8 = 0xE4;

// Write an 8×8 solid-color tile to WASM address wasmAddr (updates tile cache via GBstore).
// colorId 0-3: LSB plane = bit0 of colorId × 0xFF, MSB plane = bit1 × 0xFF.
function writeSolidTile(wasmAddr: u32, colorId: u8): void {
    const lsb: u8 = (colorId & 1) != 0 ? 0xFF : 0x00;
    const msb: u8 = (colorId & 2) != 0 ? 0xFF : 0x00;
    const gbBase: u16 = <u16>(wasmAddr - GB_VIDEO_START + 0x8000);
    for (let row: u32 = 0; row < 8; row++) {
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     lsb);
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), msb);
    }
}

// Write tileIndex into the 32×32 tile map at (tileX, tileY).
function setMapEntry(mapBase: u32, tileX: u8, tileY: u8, tileIndex: u8): void {
    store<u8>(mapBase + <u32>tileX + <u32>tileY * 32, tileIndex);
}

// Assert frame buffer shade index at (x, lY) equals colorId (with identity BGP=0xE4, shade==colorId).
function assertPixelAt(x: u8, lY: u8, colorId: u8, label: string): void {
    const actual = load<u8>(Ppu.workingBufferPtr + <u32>x + <u32>lY * 160);
    assertEquals<u8>(actual, colorId, label);
}

function assertPixel(x: u8, colorId: u8, label: string): void {
    assertPixelAt(x, 0, colorId, label);
}

// Reset emulator state and configure LCD registers. VRAM is zeroed by initPpu().
function setup(lcdc: u8, scx: u8, scy: u8, bgp: u8): void {
    initPpu();
    MemoryMap.GBstore<u8>(0xFF40, lcdc);
    MemoryMap.GBstore<u8>(0xFF43, scx);
    MemoryMap.GBstore<u8>(0xFF42, scy);
    MemoryMap.GBstore<u8>(0xFF47, bgp);
    // LY=0 by default after initPpu
}

export function testBgRendering(): boolean {
    describe("BG Rendering", () => {

        // ── SCX / SCY tile fetch ────────────────────────────────────────────
        describe("SCX/SCY tile fetch from VRAM", () => {

            it("SCX=0: pixel 0..7 from map col 0, pixel 8..15 from map col 1", () => {
                setup(LCDC_BG_OBJ, 0, 0, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 1);  // tile 0 → color 1
                writeSolidTile(TILE_BLOCK0 + 1 * 16, 3);  // tile 1 → color 3
                setMapEntry(MAP_9800, 0, 0, 0);
                setMapEntry(MAP_9800, 1, 0, 1);
                ScanlineRenderer.Render();
                assertPixel(0, 1, "SCX=0: pixel 0 uses map col 0 = color 1");
                assertPixel(4, 1, "SCX=0: pixel 4 still in tile 0 = color 1");
                assertPixel(8, 3, "SCX=0: pixel 8 uses map col 1 = color 3");
            });

            it("SCX=8: pixel 0 maps to tile col 1 (first tile fully skipped)", () => {
                setup(LCDC_BG_OBJ, 8, 0, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 1);  // tile 0 → color 1 (skipped)
                writeSolidTile(TILE_BLOCK0 + 1 * 16, 3);  // tile 1 → color 3
                setMapEntry(MAP_9800, 0, 0, 0);
                setMapEntry(MAP_9800, 1, 0, 1);
                ScanlineRenderer.Render();
                assertPixel(0, 3, "SCX=8: pixel 0 now starts at map col 1 = color 3");
            });

            it("SCY=8: LY=0+SCY=8 → mapY=8 → reads tile map row 1", () => {
                setup(LCDC_BG_OBJ, 0, 8, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 1);  // tile 0 → color 1  (row 0)
                writeSolidTile(TILE_BLOCK0 + 2 * 16, 2);  // tile 2 → color 2  (row 1)
                setMapEntry(MAP_9800, 0, 0, 0);            // map row 0, col 0 → tile 0
                setMapEntry(MAP_9800, 0, 1, 2);            // map row 1, col 0 → tile 2
                ScanlineRenderer.Render();
                assertPixel(0, 2, "SCY=8: mapY=8 → tile map row 1 → color 2");
            });

        });

        // ── Tile map selection ($9800 vs $9C00) ────────────────────────────
        describe("Tile map addressing", () => {

            it("LCDC.3=0: reads from $9800 tile map", () => {
                setup(LCDC_BG_OBJ, 0, 0, BGP_IDENTITY);          // bit3=0 → $9800
                writeSolidTile(TILE_BLOCK0 + 5 * 16, 2);          // tile 5 → color 2
                setMapEntry(MAP_9800, 0, 0, 5);                    // $9800 → tile 5
                setMapEntry(MAP_9C00, 0, 0, 0);                    // $9C00 → tile 0 (color 0, ignored)
                ScanlineRenderer.Render();
                assertPixel(0, 2, "$9800 map used: color 2");
            });

            it("LCDC.3=1: reads from $9C00 tile map", () => {
                setup(LCDC_BG_OBJ_HI, 0, 0, BGP_IDENTITY);        // bit3=1 → $9C00
                writeSolidTile(TILE_BLOCK0 + 7 * 16, 3);           // tile 7 → color 3
                setMapEntry(MAP_9800, 0, 0, 0);                     // $9800 → tile 0 (ignored)
                setMapEntry(MAP_9C00, 0, 0, 7);                     // $9C00 → tile 7
                ScanlineRenderer.Render();
                assertPixel(0, 3, "$9C00 map used: color 3");
            });

        });

        // ── Tile data signed vs unsigned indexing ──────────────────────────
        describe("Tile data indexing (LCDC.4 signed/unsigned)", () => {

            it("LCDC.4=1 ($8000 unsigned): index 0 reads from block 0 at $8000", () => {
                setup(LCDC_BG_OBJ, 0, 0, BGP_IDENTITY);           // LCDC.4=1
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 2);           // block0 tile 0 → color 2
                writeSolidTile(TILE_BLOCK2 + 0 * 16, 3);           // block2 tile 0 → color 3 (should NOT be used)
                setMapEntry(MAP_9800, 0, 0, 0);
                ScanlineRenderer.Render();
                assertPixel(0, 2, "$8000 mode: index 0 → block0 → color 2");
            });

            it("LCDC.4=0 ($8800 signed): index 0 reads from block 2 at $9000", () => {
                setup(LCDC_BG_OBJ_8800, 0, 0, BGP_IDENTITY);      // LCDC.4=0
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 1);           // block0 tile 0 → color 1 (wrong block, should NOT be used)
                writeSolidTile(TILE_BLOCK2 + 0 * 16, 3);           // block2 tile 0 → color 3 (correct block)
                setMapEntry(MAP_9800, 0, 0, 0);
                ScanlineRenderer.Render();
                assertPixel(0, 3, "$8800 signed mode: index 0 → block2 ($9000) → color 3");
            });

            it("LCDC.4=0 ($8800 signed): index 128 reads from block 1 at $8800", () => {
                setup(LCDC_BG_OBJ_8800, 0, 0, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK1 + 0 * 16, 2);           // block1 tile 0 → color 2
                setMapEntry(MAP_9800, 0, 0, 128);                   // index 128 (signed -128) → block1[0]
                ScanlineRenderer.Render();
                assertPixel(0, 2, "$8800 signed mode: index 128 → block1[0] ($8800) → color 2");
            });

        });

        // ── BGP palette register ────────────────────────────────────────────
        describe("BGP palette register", () => {

            it("BGP=0xE4 identity: tile colorId passes through unchanged", () => {
                setup(LCDC_BG_OBJ, 0, 0, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 0);           // tile 0 → raw color 0
                writeSolidTile(TILE_BLOCK0 + 1 * 16, 1);           // tile 1 → raw color 1
                writeSolidTile(TILE_BLOCK0 + 2 * 16, 2);           // tile 2 → raw color 2
                writeSolidTile(TILE_BLOCK0 + 3 * 16, 3);           // tile 3 → raw color 3
                setMapEntry(MAP_9800, 0, 0, 0);
                setMapEntry(MAP_9800, 1, 0, 1);
                setMapEntry(MAP_9800, 2, 0, 2);
                setMapEntry(MAP_9800, 3, 0, 3);
                ScanlineRenderer.Render();
                assertPixel( 0, 0, "BGP identity: raw 0 → palette[0]");
                assertPixel( 8, 1, "BGP identity: raw 1 → palette[1]");
                assertPixel(16, 2, "BGP identity: raw 2 → palette[2]");
                assertPixel(24, 3, "BGP identity: raw 3 → palette[3]");
            });

            it("BGP=0x1B reversed: tile color 0→3, 1→2, 2→1, 3→0", () => {
                // 0x1B = 00 01 10 11 : bits[1:0]=11→color0 maps to 3, [3:2]=10→color1 maps to 2, etc.
                setup(LCDC_BG_OBJ, 0, 0, 0x1B);
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 0);
                writeSolidTile(TILE_BLOCK0 + 1 * 16, 1);
                writeSolidTile(TILE_BLOCK0 + 2 * 16, 2);
                writeSolidTile(TILE_BLOCK0 + 3 * 16, 3);
                setMapEntry(MAP_9800, 0, 0, 0);
                setMapEntry(MAP_9800, 1, 0, 1);
                setMapEntry(MAP_9800, 2, 0, 2);
                setMapEntry(MAP_9800, 3, 0, 3);
                ScanlineRenderer.Render();
                assertPixel( 0, 3, "BGP 0x1B: raw 0 → mapped 3");
                assertPixel( 8, 2, "BGP 0x1B: raw 1 → mapped 2");
                assertPixel(16, 1, "BGP 0x1B: raw 2 → mapped 1");
                assertPixel(24, 0, "BGP 0x1B: raw 3 → mapped 0");
            });

            it("BGP applies to BG pixels even when OBJ (sprites) disabled", () => {
                // Spec: BGP always applies to BG pixels regardless of LCDC.1 (OBJ enable)
                setup(LCDC_BG_ONLY, 0, 0, 0x1B);   // OBJ disabled
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 0);           // raw color 0
                setMapEntry(MAP_9800, 0, 0, 0);
                ScanlineRenderer.Render();
                // BGP 0x1B maps color 0 → 3
                assertPixel(0, 3, "BGP applies with OBJ disabled: raw 0 → mapped 3");
            });

        });

        // ── 256-pixel boundary wrap ────────────────────────────────────────
        describe("BG 256-pixel boundary wrap", () => {

            it("SCX: pixel x wraps at mapX=255→0 boundary", () => {
                // SCX=248: pixel 0 → mapX=248 (col 31), pixel 8 → mapX=(248+8)u8=0 (col 0)
                setup(LCDC_BG_OBJ, 248, 0, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 1);           // tile 0 → color 1
                writeSolidTile(TILE_BLOCK0 + 1 * 16, 3);           // tile 1 → color 3
                setMapEntry(MAP_9800, 31, 0, 1);                    // col 31 → tile 1 = color 3
                setMapEntry(MAP_9800,  0, 0, 0);                    // col 0  → tile 0 = color 1
                ScanlineRenderer.Render();
                assertPixel(0, 3, "SCX=248: pixel 0 at map col 31 = color 3");
                assertPixel(8, 1, "SCX=248: pixel 8 wraps to map col 0 = color 1");
            });

            it("SCY: (LY+SCY) wraps at 256 into tile map row 0", () => {
                // SCY=248, LY=0: mapY=248 → tile row 31
                // SCY=248, LY=8: mapY=(8+248)u8=0 → tile row 0  ← wrap
                setup(LCDC_BG_OBJ, 0, 248, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK0 + 0 * 16, 2);           // tile 0 → color 2
                writeSolidTile(TILE_BLOCK0 + 1 * 16, 1);           // tile 1 → color 1
                setMapEntry(MAP_9800, 0,  0, 0);                    // row 0  → tile 0 = color 2
                setMapEntry(MAP_9800, 0, 31, 1);                    // row 31 → tile 1 = color 1

                // LY=0: mapY=248 → row 31 → color 1
                Lcd.data.lY = 0;
                ScanlineRenderer.Render();
                assertPixelAt(0, 0, 1, "LY=0, SCY=248: mapY=248 → row 31 → color 1");

                // LY=8: mapY=(8+248)u8=0 → row 0 → color 2  (Y wrap)
                Lcd.data.lY = 8;
                ScanlineRenderer.Render();
                assertPixelAt(0, 8, 2, "LY=8, SCY=248: mapY=0 (wrapped) → row 0 → color 2");
            });

        });

    });

    return true;
}
