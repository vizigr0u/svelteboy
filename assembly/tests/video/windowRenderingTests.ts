import { Ppu } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_VIDEO_START } from "../../memory/memoryConstants";
import { describe, it, assertEquals } from "../framework";
import { setTestRom } from "../cpuTests";
import { tickPpuDots } from "./ppuTestHelpers";

// WASM-relative offsets within VRAM bank (GB 0x8000 base)
const BG_MAP_OFFSET:  u32 = 0x1800; // GB 0x9800
const WIN_MAP_OFFSET: u32 = 0x1C00; // GB 0x9C00

// LCDC bit masks
const LCDC_PPU_EN:     u8 = 0x80; // bit 7
const LCDC_WIN_MAP_HI: u8 = 0x40; // bit 6: window tilemap 1=9C00
const LCDC_WIN_EN:     u8 = 0x20; // bit 5
const LCDC_TILE_LO:    u8 = 0x10; // bit 4: tile data 1=8000 unsigned
const LCDC_BGWIN_EN:   u8 = 0x01; // bit 0

// Base LCDC: PPU + window + tiles@8000 + BG+Win on, no OBJ, BG map@9800, Win map@9800
const BASE_LCDC: u8 = LCDC_PPU_EN | LCDC_WIN_EN | LCDC_TILE_LO | LCDC_BGWIN_EN;

// Encode a tile row as little-endian u16 for the given colorId (0-3)
// [low_addr = LSB_plane, low_addr+1 = MSB_plane]
function tileRowWord(colorId: u8): u16 {
    const lo: u8 = (colorId & 1) != 0 ? 0xFF : 0x00;
    const hi: u8 = (colorId & 2) != 0 ? 0xFF : 0x00;
    return <u16>lo | (<u16>hi << 8);
}

// Write an 8×8 solid-color tile at tileIndex (updates tile cache via GBstore)
function writeSolidTile(tileIndex: u32, colorId: u8): void {
    const row = tileRowWord(colorId);
    const gbBase: u16 = <u16>(0x8000 + tileIndex * 16);
    for (let r: u32 = 0; r < 8; r++) {
        MemoryMap.GBstore<u8>(gbBase + <u16>(r * 2),     <u8>row);
        MemoryMap.GBstore<u8>(gbBase + <u16>(r * 2 + 1), <u8>(row >> 8));
    }
}

// Write a gradient tile: row R uses colorId ((R+1) & 3) (updates tile cache via GBstore)
function writeGradientTile(tileIndex: u32): void {
    const gbBase: u16 = <u16>(0x8000 + tileIndex * 16);
    for (let r: u32 = 0; r < 8; r++) {
        const row = tileRowWord(<u8>((r + 1) & 3));
        MemoryMap.GBstore<u8>(gbBase + <u16>(r * 2),     <u8>row);
        MemoryMap.GBstore<u8>(gbBase + <u16>(r * 2 + 1), <u8>(row >> 8));
    }
}

// Fill all 1024 entries of a 32×32 tilemap with tileIndex
function fillTileMap(mapOffset: u32, tileIndex: u8): void {
    const base = GB_VIDEO_START + mapOffset;
    for (let i: u32 = 0; i < 1024; i++) {
        store<u8>(base + i, tileIndex);
    }
}

// Read a pixel from the working frame buffer at scanline ly, column x
function getPixel(x: u32, ly: u32): u32 {
    return Ppu.workingBuffer[ly * 160 + x];
}

// Expected 32-bit colour for colorId i (palette[i] with identity BGP=0xE4)
function expectedColor(colorId: u8): u32 {
    return unchecked(Ppu.current32bitPalette[colorId]);
}

// Fully initialise a window test: reset, write tiles, fill maps, set registers.
// Calls Lcd.ResetLine() at the end so _windowVisible is correct for scanline 0.
// lcdc should have LCDC_PPU_EN and LCDC_WIN_EN; wy/wx set the window position.
// bgTile/winTile are tile indices: bgTile filled with colorId 0, winTile with colorId 1.
function initTest(lcdc: u8, wy: u8, wx: u8, bgTile: u8, winTile: u8): void {
    setTestRom([0x00]);
    writeSolidTile(<u32>bgTile,  0);  // BG tile  → colorId 0
    writeSolidTile(<u32>winTile, 1);  // Win tile → colorId 1
    fillTileMap(BG_MAP_OFFSET,  bgTile);
    fillTileMap(WIN_MAP_OFFSET, winTile);
    MemoryMap.GBstore<u8>(0xFF47, 0xE4); // BGP identity (colorId → colorId)
    MemoryMap.GBstore<u8>(0xFF42, 0);    // SCY=0
    MemoryMap.GBstore<u8>(0xFF43, 0);    // SCX=0
    MemoryMap.GBstore<u8>(0xFF40, lcdc); // set PPU+window enable first (updates _windowEnabled)
    MemoryMap.GBstore<u8>(0xFF4A, wy);   // WY
    MemoryMap.GBstore<u8>(0xFF4B, wx);   // WX
    // Recompute _windowVisible with the just-set registers; also zeros lY and windowLy
    Lcd.ResetLine();
}

// Initialise a WLY test with a gradient window tile (tile 2) at given WY
function initWlyTest(wy: u8): void {
    const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
    setTestRom([0x00]);
    writeSolidTile(0, 0);        // BG tile 0  → all colorId 0
    writeGradientTile(2);        // Win tile 2 → row R → colorId (R+1)&3
    fillTileMap(BG_MAP_OFFSET,  0);
    fillTileMap(WIN_MAP_OFFSET, 2);
    MemoryMap.GBstore<u8>(0xFF47, 0xE4);
    MemoryMap.GBstore<u8>(0xFF42, 0);
    MemoryMap.GBstore<u8>(0xFF43, 0);
    MemoryMap.GBstore<u8>(0xFF40, lcdc);
    MemoryMap.GBstore<u8>(0xFF4A, wy);
    MemoryMap.GBstore<u8>(0xFF4B, 7);   // WX=7 → window starts at pixel 0
    Lcd.ResetLine();
}

// Advance from fresh-reset PPU to the Transfer phase of scanline `ly`.
// Each scanline = 456 dots; Transfer starts at dot 80 (end of OAMScan).
function renderToScanline(ly: u32): void {
    tickPpuDots(ly * 456 + 80);
}

export function testWindowRendering(): boolean {

    // ─────────────────────────────────────────────────────────────────────────
    describe("Window only draws when WY <= LY", () => {

        it("scanline before WY uses BG tile", () => {
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 5, 7, 0, 1); // WY=5, BG map=9800 tile0, Win map=9C00 tile1
            fillTileMap(BG_MAP_OFFSET,  0);
            fillTileMap(WIN_MAP_OFFSET, 1);
            renderToScanline(4); // LY=4 < WY=5 → BG
            assertEquals<u32>(getPixel(0, 4), expectedColor(0),
                "LY=4 < WY=5: pixel is BG colorId 0");
        });

        it("first scanline at WY renders window tile", () => {
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 5, 7, 0, 1);
            fillTileMap(BG_MAP_OFFSET,  0);
            fillTileMap(WIN_MAP_OFFSET, 1);
            renderToScanline(5); // LY=5 == WY=5 → window
            assertEquals<u32>(getPixel(0, 5), expectedColor(1),
                "LY=5 == WY=5: pixel is window colorId 1");
        });

        it("scanlines after WY also render window tile", () => {
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 5, 7, 0, 1);
            fillTileMap(BG_MAP_OFFSET,  0);
            fillTileMap(WIN_MAP_OFFSET, 1);
            renderToScanline(10); // LY=10 > WY=5 → still window
            assertEquals<u32>(getPixel(0, 10), expectedColor(1),
                "LY=10 > WY=5: pixel is window colorId 1");
        });

        it("WY=0 makes entire frame a window region", () => {
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 0, 7, 0, 1); // WY=0 → window active from scanline 0
            fillTileMap(BG_MAP_OFFSET,  0);
            fillTileMap(WIN_MAP_OFFSET, 1);
            renderToScanline(0);
            assertEquals<u32>(getPixel(0, 0), expectedColor(1),
                "LY=0 WY=0: pixel is window colorId 1");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe("Window X position (WX-7 pixel offset)", () => {

        it("WX=7: window starts at pixel 0 (covers full width)", () => {
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 0, 7, 0, 1);
            fillTileMap(BG_MAP_OFFSET,  0);
            fillTileMap(WIN_MAP_OFFSET, 1);
            renderToScanline(0);
            assertEquals<u32>(getPixel(0,   0), expectedColor(1), "WX=7: pixel 0 is window");
            assertEquals<u32>(getPixel(159, 0), expectedColor(1), "WX=7: pixel 159 is window");
        });

        it("WX=15: window starts at pixel 8 (pixels 0-7 are BG)", () => {
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 0, 15, 0, 1); // WX=15 → window at x = 15-7 = 8
            fillTileMap(BG_MAP_OFFSET,  0);
            fillTileMap(WIN_MAP_OFFSET, 1);
            renderToScanline(0);
            assertEquals<u32>(getPixel(0,   0), expectedColor(0), "WX=15: pixel 0 is BG");
            assertEquals<u32>(getPixel(7,   0), expectedColor(0), "WX=15: pixel 7 is BG");
            assertEquals<u32>(getPixel(8,   0), expectedColor(1), "WX=15: pixel 8 is window");
            assertEquals<u32>(getPixel(159, 0), expectedColor(1), "WX=15: pixel 159 is window");
        });

        it("WX=23: window starts at pixel 16 (pixels 0-15 are BG)", () => {
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 0, 23, 0, 1); // WX=23 → window at x = 23-7 = 16
            fillTileMap(BG_MAP_OFFSET,  0);
            fillTileMap(WIN_MAP_OFFSET, 1);
            renderToScanline(0);
            assertEquals<u32>(getPixel(15, 0), expectedColor(0), "WX=23: pixel 15 is BG");
            assertEquals<u32>(getPixel(16, 0), expectedColor(1), "WX=23: pixel 16 is window");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Window internal line counter (WLY):
    // Per Pan Docs: WLY increments ONLY when window renders on a scanline.
    // WLY=0 on the first window scanline (LY==WY), not LY==WY+1.
    describe("Window internal line counter (WLY)", () => {

        it("WLY=0 on first window scanline → renders tile row 0", () => {
            // gradient tile: row 0 → colorId 1, row 1 → colorId 2, row 2 → colorId 3
            // WY=3: first window line is LY=3, which should use WLY=0 → tile row 0 → colorId 1
            initWlyTest(3);
            renderToScanline(3);
            assertEquals<u32>(getPixel(0, 3), expectedColor(1),
                "LY=3 first window line: WLY=0 → tile row 0 → colorId 1");
        });

        it("WLY increments on each successive window scanline", () => {
            // LY=3 → WLY=0 → colorId 1
            // LY=4 → WLY=1 → colorId 2
            // LY=5 → WLY=2 → colorId 3
            initWlyTest(3);
            renderToScanline(3);       // renders LY=3; PPU now at dot=80 of LY=3
            assertEquals<u32>(getPixel(0, 3), expectedColor(1), "LY=3: WLY=0 → colorId 1");
            tickPpuDots(456);          // completes LY=3, renders LY=4
            assertEquals<u32>(getPixel(0, 4), expectedColor(2), "LY=4: WLY=1 → colorId 2");
            tickPpuDots(456);          // completes LY=4, renders LY=5
            assertEquals<u32>(getPixel(0, 5), expectedColor(3), "LY=5: WLY=2 → colorId 3");
        });

        it("WLY resets to 0 at start of each frame", () => {
            // Run through one full frame (154 scanlines) then check WLY=0 at frame 2 LY=3
            initWlyTest(3);
            renderToScanline(3 + 154); // frame 2, scanline 3 (= scan 157 from start)
            assertEquals<u32>(getPixel(0, 3), expectedColor(1),
                "Frame 2 LY=3: WLY reset to 0 → tile row 0 → colorId 1");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    describe("Window uses separate tile map from BG", () => {

        it("LCDC.6=1: window reads from 0x9C00, BG reads from 0x9800", () => {
            // 9800 filled with tile 0 (colorId 0), 9C00 filled with tile 1 (colorId 1)
            // WX=7, WY=0 → entire scanline is window region
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 0, 7, 0, 1);
            fillTileMap(BG_MAP_OFFSET,  0); // 9800 → tile 0 (colorId 0)
            fillTileMap(WIN_MAP_OFFSET, 1); // 9C00 → tile 1 (colorId 1)
            renderToScanline(0);
            assertEquals<u32>(getPixel(0,   0), expectedColor(1),
                "LCDC.6=1: window at 9C00 → colorId 1");
            assertEquals<u32>(getPixel(159, 0), expectedColor(1),
                "LCDC.6=1: window covers full width → colorId 1");
        });

        it("LCDC.6=0: window reads from 0x9800 (same as BG)", () => {
            // Both use 9800, which has tile 0 (colorId 0)
            const lcdc: u8 = BASE_LCDC; // LCDC.6=0 → win map = 9800
            initTest(lcdc, 0, 7, 0, 1);
            fillTileMap(BG_MAP_OFFSET,  0); // 9800 → tile 0 (colorId 0)
            fillTileMap(WIN_MAP_OFFSET, 1); // 9C00 irrelevant since LCDC.6=0
            renderToScanline(0);
            assertEquals<u32>(getPixel(0, 0), expectedColor(0),
                "LCDC.6=0: window reads 9800 → tile 0 → colorId 0");
        });

        it("disabling window (LCDC.5=0) shows BG tile map instead", () => {
            // Window disabled → only BG renders; 9800 has tile 0 (colorId 0)
            const lcdc: u8 = LCDC_PPU_EN | LCDC_TILE_LO | LCDC_BGWIN_EN; // no LCDC_WIN_EN
            initTest(lcdc, 0, 7, 0, 1);
            fillTileMap(BG_MAP_OFFSET,  0); // 9800 → tile 0 (colorId 0)
            fillTileMap(WIN_MAP_OFFSET, 1); // ignored
            renderToScanline(0);
            assertEquals<u32>(getPixel(0, 0), expectedColor(0),
                "Window disabled: BG from 9800 → tile 0 → colorId 0");
        });

        it("different tile contents in 9800 vs 9C00 are rendered independently", () => {
            // BG tile 0 in 9800 (colorId 3), window tile 1 in 9C00 (colorId 2), WY=5
            // renderToScanline(5) renders LY=0..5 in one shot:
            //   LY=4 uses BG (window not yet active) → tile 0 → colorId 3
            //   LY=5 uses window (WY==LY) → tile 1 → colorId 2
            const lcdc: u8 = BASE_LCDC | LCDC_WIN_MAP_HI;
            initTest(lcdc, 5, 7, 0, 0); // generic init (both tiles will be overwritten)
            writeSolidTile(0, 3);        // overwrite tile 0 → colorId 3  (BG)
            writeSolidTile(1, 2);        // overwrite tile 1 → colorId 2  (window)
            fillTileMap(BG_MAP_OFFSET,  0); // 9800 → tile 0 (colorId 3)
            fillTileMap(WIN_MAP_OFFSET, 1); // 9C00 → tile 1 (colorId 2)
            renderToScanline(5); // renders LY 0-5; check both
            assertEquals<u32>(getPixel(0, 4), expectedColor(3),
                "LY=4 < WY=5: BG from 9800 → tile 0 → colorId 3");
            assertEquals<u32>(getPixel(0, 5), expectedColor(2),
                "LY=5 == WY=5: window from 9C00 → tile 1 → colorId 2");
        });
    });

    return true;
}
