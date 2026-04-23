import { Lcd } from "../../io/video/lcd";
import { Ppu, PpuMode } from "../../io/video/ppu";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_VIDEO_START } from "../../memory/memoryConstants";
import { describe, it, assertEquals } from "../framework";
import { initPpu, tickPpuDots } from "./ppuTestHelpers";

const LCDC_ADDR: u16 = 0xFF40;
const WY_ADDR: u16 = 0xFF4A;
const WX_ADDR: u16 = 0xFF4B;

// WASM memory offsets matching lcd.ts private constants
const TILE_BASE_LO: u32 = GB_VIDEO_START;           // GB 0x8000 — unsigned tile method
const TILE_BASE_HI: u32 = GB_VIDEO_START + 0x800;   // GB 0x8800 — signed tile method
const MAP_BASE_LO: u32 = GB_VIDEO_START + 0x1800;   // GB 0x9800
const MAP_BASE_HI: u32 = GB_VIDEO_START + 0x1C00;   // GB 0x9C00

function setLCDC(value: u8): void {
    MemoryMap.GBstore<u8>(LCDC_ADDR, value);
}

function getLCDC(): u8 {
    return MemoryMap.GBload<u8>(LCDC_ADDR);
}

export function testLcdc(): boolean {
    describe("LCDC Register", () => {

        // ── Bit 7: PPU enable/disable ─────────────────────────────────────────
        describe("Bit 7 — PPU enable/disable", () => {
            it("PPU enabled after initPpu", () => {
                initPpu();
                assertEquals<bool>(Lcd.IsPpuEnabled, true, "PPU enabled");
            });

            it("disabling during OAMScan (mode 2) is ignored", () => {
                initPpu();
                assertEquals<u8>(<u8>Ppu.currentMode, <u8>PpuMode.OAMScan, "in OAMScan");
                setLCDC(0x00);
                assertEquals<bool>(Lcd.IsPpuEnabled, true, "PPU still enabled");
                assertEquals<u8>(getLCDC() & 0x80, 0x80, "LCDC bit 7 intact");
            });

            it("disabling during Transfer (mode 3) is ignored", () => {
                initPpu();
                tickPpuDots(80); // enter Transfer
                assertEquals<u8>(<u8>Ppu.currentMode, <u8>PpuMode.Transfer, "in Transfer");
                setLCDC(0x00);
                assertEquals<bool>(Lcd.IsPpuEnabled, true, "PPU still enabled");
            });

            it("disabling during HBlank (mode 0) is ignored", () => {
                initPpu();
                tickPpuDots(252); // enter HBlank
                assertEquals<u8>(<u8>Ppu.currentMode, <u8>PpuMode.HBlank, "in HBlank");
                setLCDC(0x00);
                assertEquals<bool>(Lcd.IsPpuEnabled, true, "PPU still enabled");
            });

            it("disabling during VBlank (mode 1) is allowed", () => {
                initPpu();
                tickPpuDots(144 * 456); // enter VBlank
                assertEquals<u8>(<u8>Ppu.currentMode, <u8>PpuMode.VBlank, "in VBlank");
                setLCDC(0x00);
                assertEquals<bool>(Lcd.IsPpuEnabled, false, "PPU disabled");
            });

            it("re-enabling PPU from disabled state works", () => {
                initPpu();
                tickPpuDots(144 * 456);
                setLCDC(0x00); // disable during VBlank
                setLCDC(0x80); // re-enable
                assertEquals<bool>(Lcd.IsPpuEnabled, true, "PPU re-enabled");
            });

            it("STAT mode bits report 0 when PPU disabled (LCDC.7=0)", () => {
                initPpu();
                tickPpuDots(144 * 456); // enter VBlank
                setLCDC(0x00);          // disable PPU
                const stat = MemoryMap.GBload<u8>(0xFF41);
                assertEquals<u8>(stat & 0x03, 0, "STAT mode bits = 0 when PPU off");
            });

            // Regression: guard checked (value & 7) instead of (value & 0x80)
            it("disabling with other bits set (e.g. 0x04) outside VBlank is ignored", () => {
                initPpu();
                assertEquals<u8>(<u8>Ppu.currentMode, <u8>PpuMode.OAMScan, "in OAMScan");
                setLCDC(0x04); // bit 7 = 0, bit 2 = 1 — should still be rejected
                assertEquals<bool>(Lcd.IsPpuEnabled, true, "PPU still enabled");
                assertEquals<u8>(getLCDC() & 0x80, 0x80, "LCDC bit 7 intact");
            });
        });

        // ── Bit 0: BG+Window enable ───────────────────────────────────────────
        describe("Bit 0 — BG+Window enable", () => {
            it("BG disabled when bit 0 = 0", () => {
                initPpu(); // LCDC = 0x80
                assertEquals<bool>(Lcd.BGandWindowVisible, false, "BG disabled");
            });

            it("BG enabled when bit 0 = 1", () => {
                initPpu();
                setLCDC(0x80 | 0x01);
                assertEquals<bool>(Lcd.BGandWindowVisible, true, "BG enabled");
            });

            it("BG toggles off after clearing bit 0", () => {
                initPpu();
                setLCDC(0x80 | 0x01);
                assertEquals<bool>(Lcd.BGandWindowVisible, true, "BG on");
                setLCDC(0x80);
                assertEquals<bool>(Lcd.BGandWindowVisible, false, "BG off");
            });

            it("window enable (bit 5) ignored when bit 0 = 0 (DMG: window overridden off)", () => {
                initPpu();
                MemoryMap.GBstore<u8>(WY_ADDR, 0);
                MemoryMap.GBstore<u8>(WX_ADDR, 7);
                // bit5=1 (window enable) but bit0=0 (BG+Win disabled) → window must not show
                setLCDC(0x80 | 0x20); // PPU + window enable, no bit 0
                tickPpuDots(456);
                assertEquals<bool>(Lcd.IsWindowVisible, false, "window suppressed when LCDC.0=0");
            });
        });

        // ── Bit 1: OBJ (sprite) enable ────────────────────────────────────────
        describe("Bit 1 — OBJ enable", () => {
            it("sprites disabled when bit 1 = 0", () => {
                initPpu();
                assertEquals<bool>(Lcd.SpritesVisible, false, "sprites disabled");
            });

            it("sprites enabled when bit 1 = 1", () => {
                initPpu();
                setLCDC(0x80 | 0x02);
                assertEquals<bool>(Lcd.SpritesVisible, true, "sprites enabled");
            });

            it("sprites toggle off after clearing bit 1", () => {
                initPpu();
                setLCDC(0x80 | 0x02);
                assertEquals<bool>(Lcd.SpritesVisible, true, "sprites on");
                setLCDC(0x80);
                assertEquals<bool>(Lcd.SpritesVisible, false, "sprites off");
            });
        });

        // ── Bit 2: OBJ size ───────────────────────────────────────────────────
        describe("Bit 2 — OBJ size (8×8 vs 8×16)", () => {
            it("8×8 when bit 2 = 0", () => {
                initPpu();
                setLCDC(0x80);
                assertEquals<u8>(Lcd.SpriteHeight, 8, "height=8");
            });

            it("8×16 when bit 2 = 1", () => {
                initPpu();
                setLCDC(0x80 | 0x04);
                assertEquals<u8>(Lcd.SpriteHeight, 16, "height=16");
            });

            it("size toggles back to 8×8", () => {
                initPpu();
                setLCDC(0x80 | 0x04);
                assertEquals<u8>(Lcd.SpriteHeight, 16, "8×16");
                setLCDC(0x80);
                assertEquals<u8>(Lcd.SpriteHeight, 8, "8×8");
            });
        });

        // ── Bit 3: BG tile map area ───────────────────────────────────────────
        describe("Bit 3 — BG tile map area (0x9800 vs 0x9C00)", () => {
            it("BG map at 0x9800 when bit 3 = 0", () => {
                initPpu();
                setLCDC(0x80);
                assertEquals<u32>(Lcd.BgTileMapBaseAddress, MAP_BASE_LO, "BG map 0x9800");
            });

            it("BG map at 0x9C00 when bit 3 = 1", () => {
                initPpu();
                setLCDC(0x80 | 0x08);
                assertEquals<u32>(Lcd.BgTileMapBaseAddress, MAP_BASE_HI, "BG map 0x9C00");
            });

            it("BG map area toggles back to 0x9800", () => {
                initPpu();
                setLCDC(0x80 | 0x08);
                assertEquals<u32>(Lcd.BgTileMapBaseAddress, MAP_BASE_HI, "0x9C00");
                setLCDC(0x80);
                assertEquals<u32>(Lcd.BgTileMapBaseAddress, MAP_BASE_LO, "0x9800");
            });
        });

        // ── Bit 4: Tile data area ─────────────────────────────────────────────
        // Pan Docs: bit4=0 → 0x8800 base (signed method); bit4=1 → 0x8000 base (unsigned)
        describe("Bit 4 — BG+Window tile data area (0x8800 signed vs 0x8000 unsigned)", () => {
            it("tile data at 0x8800 (signed) when bit 4 = 0", () => {
                initPpu();
                setLCDC(0x80); // bit 4 = 0
                assertEquals<u32>(Lcd.TilesBaseAddress, TILE_BASE_HI, "tile base 0x8800");
            });

            it("tile data at 0x8000 (unsigned) when bit 4 = 1", () => {
                initPpu();
                setLCDC(0x80 | 0x10);
                assertEquals<u32>(Lcd.TilesBaseAddress, TILE_BASE_LO, "tile base 0x8000");
            });

            it("tile data area toggles back to 0x8800", () => {
                initPpu();
                setLCDC(0x80 | 0x10);
                assertEquals<u32>(Lcd.TilesBaseAddress, TILE_BASE_LO, "0x8000");
                setLCDC(0x80);
                assertEquals<u32>(Lcd.TilesBaseAddress, TILE_BASE_HI, "0x8800");
            });
        });

        // ── Bit 5: Window enable ──────────────────────────────────────────────
        // _windowVisible cache is updated by NextLine — tick a scanline after LCDC change
        describe("Bit 5 — Window enable", () => {
            it("window not visible when bit 5 = 0 (with valid WY/WX)", () => {
                initPpu();
                MemoryMap.GBstore<u8>(WY_ADDR, 0);
                MemoryMap.GBstore<u8>(WX_ADDR, 7);
                setLCDC(0x80); // bit 5 = 0
                tickPpuDots(456); // NextLine updates _windowVisible
                assertEquals<bool>(Lcd.IsWindowVisible, false, "window not visible");
            });

            it("window visible when bit 5 = 1 with valid WY/WX (bit 0 also set)", () => {
                initPpu();
                MemoryMap.GBstore<u8>(WY_ADDR, 0);
                MemoryMap.GBstore<u8>(WX_ADDR, 7);
                setLCDC(0x80 | 0x20 | 0x01); // bit 5 = 1, bit 0 = 1 (BG+Win enable required)
                tickPpuDots(456); // LY becomes 1, NextLine checks WY=0 ≤ LY=1
                assertEquals<bool>(Lcd.IsWindowVisible, true, "window visible");
            });

            it("window disabled again after clearing bit 5", () => {
                initPpu();
                MemoryMap.GBstore<u8>(WY_ADDR, 0);
                MemoryMap.GBstore<u8>(WX_ADDR, 7);
                setLCDC(0x80 | 0x20 | 0x01); // bit 5 = 1, bit 0 = 1
                tickPpuDots(456);
                assertEquals<bool>(Lcd.IsWindowVisible, true, "window on");
                setLCDC(0x80 | 0x01); // clear bit 5, keep bit 0
                tickPpuDots(456); // NextLine updates _windowVisible
                assertEquals<bool>(Lcd.IsWindowVisible, false, "window off");
            });
        });

        // ── Bit 6: Window tile map area ───────────────────────────────────────
        describe("Bit 6 — Window tile map area (0x9800 vs 0x9C00)", () => {
            it("window map at 0x9800 when bit 6 = 0", () => {
                initPpu();
                setLCDC(0x80); // bit 6 = 0
                assertEquals<u32>(Lcd.WindowTileMapBaseAddress, MAP_BASE_LO, "win map 0x9800");
            });

            it("window map at 0x9C00 when bit 6 = 1", () => {
                initPpu();
                setLCDC(0x80 | 0x40);
                assertEquals<u32>(Lcd.WindowTileMapBaseAddress, MAP_BASE_HI, "win map 0x9C00");
            });

            it("window map area toggles back to 0x9800", () => {
                initPpu();
                setLCDC(0x80 | 0x40);
                assertEquals<u32>(Lcd.WindowTileMapBaseAddress, MAP_BASE_HI, "0x9C00");
                setLCDC(0x80);
                assertEquals<u32>(Lcd.WindowTileMapBaseAddress, MAP_BASE_LO, "0x9800");
            });
        });

    });

    return true;
}
