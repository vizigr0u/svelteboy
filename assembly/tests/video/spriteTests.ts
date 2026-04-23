import { describe, it, assertEquals } from "../framework";
import { Ppu, PpuOamFifo } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_OAM_START, GB_VIDEO_START } from "../../memory/memoryConstants";
import { initPpu } from "./ppuTestHelpers";

// --- helpers ---

function setOamEntry(index: u8, yPos: u8, xPos: u8, tileIndex: u8, flags: u8): void {
    const base = GB_OAM_START + <u32>index * 4;
    store<u8>(base + 0, yPos);
    store<u8>(base + 1, xPos);
    store<u8>(base + 2, tileIndex);
    store<u8>(base + 3, flags);
}

// Each tile row = 2 bytes: lo (LSB of color IDs), hi (MSB). Bit 7 = leftmost pixel.
// Uses GBstore so the tile decode cache is updated.
function setTileRow(tileIndex: u8, row: u8, lo: u8, hi: u8): void {
    const gbBase: u16 = <u16>(0x8000 + <u32>tileIndex * 16 + <u32>row * 2);
    MemoryMap.GBstore<u8>(gbBase,     lo);
    MemoryMap.GBstore<u8>(gbBase + 1, hi);
}

function setTileSolid(tileIndex: u8, lo: u8, hi: u8): void {
    for (let row: u8 = 0; row < 8; row++) setTileRow(tileIndex, row, lo, hi);
}

function getPixel(x: u32, y: u32 = 0): u8 {
    return load<u8>(Ppu.workingBufferPtr + y * 160 + x);
}

// Expected shade index: apply palette register to colorId.
function expectedShade(colorId: u8, paletteReg: u8): u8 {
    return Ppu.applyPalette(colorId, paletteReg);
}

// LCDC 0x93 = PPU(7) + TileAreaLow(4) + OBJ(1) + BG(0)
// LCDC 0x82 = PPU(7) + OBJ(1)  -- BG disabled
// LCDC 0x86 = PPU(7) + ObjSize8x16(2) + OBJ(1)
function setupSprites(lcdc: u8 = 0x93): void {
    initPpu();
    MemoryMap.GBstore<u8>(0xFF40, lcdc);
    MemoryMap.GBstore<u8>(0xFF47, 0xE4); // BGP  identity: 0→0, 1→1, 2→2, 3→3
    MemoryMap.GBstore<u8>(0xFF48, 0xE4); // OBP0 identity: 0→0, 1→1, 2→2, 3→3
    // OBP1: color1 → shade2 (bits3-2 = 10 = 0b10 = 2)
    // 0x18 = 0b00011000: bits3-2=10 → applyPalette(1,0x18)=(0x18>>2)&3=2
    MemoryMap.GBstore<u8>(0xFF49, 0x18);
}

// Set LY, repopulate OAM FIFO, render the scanline.
function renderLine(ly: u8 = 0): void {
    Lcd.setLY(ly);
    PpuOamFifo.FetchCurrentLine();
    ScanlineRenderer.Render();
}

export function testSprites(): boolean {

    // ── OAM scan ─────────────────────────────────────────────────────────────

    describe("sprite OAM scan", () => {
        it("includes sprite when Y overlaps scanline", () => {
            setupSprites();
            setOamEntry(0, 16, 8, 0, 0); // yPos=16 → top of screen; xPos=8 → x=0
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 1, "fifo size");
        });

        it("excludes sprite when Y does not overlap scanline", () => {
            setupSprites();
            setOamEntry(0, 24, 8, 0, 0); // yPos=24 → sprite starts at y=8
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 0, "fifo size");
        });

        it("includes sprite at last valid row", () => {
            setupSprites();
            setOamEntry(0, 16, 8, 0, 0); // 8x8: valid rows 0-7
            Lcd.setLY(7);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 1, "fifo at last row");
        });

        it("excludes sprite one past last row", () => {
            setupSprites();
            setOamEntry(0, 16, 8, 0, 0);
            Lcd.setLY(8);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 0, "fifo past last row");
        });

        it("enforces 10-sprite-per-line limit", () => {
            setupSprites();
            for (let i: u8 = 0; i < 11; i++) {
                setOamEntry(i, 16, <u8>(8 + i * 8), 0, 0);
            }
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 10, "max 10 sprites per line");
        });

        it("X=0 sprite (hidden) still counts toward 10-sprite limit", () => {
            setupSprites();
            for (let i: u8 = 0; i < 10; i++) {
                setOamEntry(i, 16, 0, 0, 0); // X=0: off-screen left, still Y-selected
            }
            setOamEntry(10, 16, 8, 0, 0); // visible sprite; should NOT be selected (limit reached)
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 10, "X=0 sprites count toward limit; 11th excluded");
        });

        it("X>=168 sprite (hidden) still counts toward 10-sprite limit", () => {
            setupSprites();
            for (let i: u8 = 0; i < 10; i++) {
                setOamEntry(i, 16, 168, 0, 0); // X=168: screen_x=160, off right edge
            }
            setOamEntry(10, 16, 8, 0, 0);
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 10, "X=168 sprites count toward limit; 11th excluded");
        });
    });

    // ── DMG drawing priority ─────────────────────────────────────────────────

    describe("DMG sprite drawing priority", () => {
        it("lower X sprite draws on top regardless of OAM index", () => {
            setupSprites(0x82); // no BG
            setTileSolid(0, 0xFF, 0xFF); // tile 0 all color3
            setTileSolid(1, 0xFF, 0x00); // tile 1 all color1
            // Sprite 0 (index 0): xPos=12 → screen x=4..11, tile 0 (color3)
            // Sprite 1 (index 1): xPos=8  → screen x=0..7,  tile 1 (color1)
            // Overlap at screen x=4..7: sprite 1 has lower X (8 < 12) → sprite 1 wins
            setOamEntry(0, 16, 12, 0, 0);
            setOamEntry(1, 16,  8, 1, 0);
            renderLine(0);
            assertEquals<u8>(getPixel(4), expectedShade(1, 0xE4), "lower X wins at overlap pixel x=4");
            assertEquals<u8>(getPixel(8), expectedShade(3, 0xE4), "higher X sprite only at x=8 (no overlap)");
        });

        it("lower OAM index wins when X is equal", () => {
            setupSprites(0x82);
            setTileSolid(0, 0xFF, 0xFF); // tile 0 all color3
            setTileSolid(1, 0xFF, 0x00); // tile 1 all color1
            // Same xPos=8: lower OAM index (0) wins → color3
            setOamEntry(0, 16, 8, 0, 0);
            setOamEntry(1, 16, 8, 1, 0);
            renderLine(0);
            assertEquals<u8>(getPixel(0), expectedShade(3, 0xE4), "lower OAM index wins on X tie");
        });
    });

    // ── Rendering ────────────────────────────────────────────────────────────

    describe("sprite rendering", () => {
        it("renders opaque sprite pixel from tile data", () => {
            setupSprites(0x82); // no BG
            setTileSolid(0, 0xFF, 0x00); // all pixels color 1
            setOamEntry(0, 16, 8, 0, 0); // sprite at screen x=0
            renderLine(0);
            assertEquals<u8>(getPixel(0), expectedShade(1, 0xE4), "pixel 0 color via OBP0");
        });

        it("color 0 is transparent — shows BG underneath", () => {
            setupSprites(0x93); // BG + OBJ, tile area low (bit4)
            // BG: map entry 0 → tile 1, solid color 3
            store<u8>(GB_VIDEO_START + 0x1800, 1);
            setTileSolid(1, 0xFF, 0xFF); // tile 1 all color 3
            // Sprite tile 0 row 0: pixel 0 (bit7) = color 0, pixels 1-7 = color 1
            // lo=0x7F: bit7=0 → LSB=0; hi=0x00: bit7=0 → MSB=0 → pixel0 = color 0
            // lo=0x7F: bits6-0=1 → LSB=1; hi=0x00 → MSB=0 → pixels 1-7 = color 1
            setTileRow(0, 0, 0x7F, 0x00);
            setOamEntry(0, 16, 8, 0, 0);
            renderLine(0);
            assertEquals<u8>(getPixel(0), expectedShade(3, 0xE4), "transparent pixel shows BG");
            assertEquals<u8>(getPixel(1), expectedShade(1, 0xE4), "opaque pixel shows sprite");
        });

        it("OBP0 vs OBP1 palette selection via attribute bit 4", () => {
            setupSprites(0x82); // no BG
            setTileSolid(0, 0xFF, 0x00); // all color 1
            setOamEntry(0, 16,  8, 0, 0x00); // x=0,  OBP0 (bit4=0)
            setOamEntry(1, 16, 16, 0, 0x10); // x=8,  OBP1 (bit4=1)
            renderLine(0);
            assertEquals<u8>(getPixel(0), expectedShade(1, 0xE4), "OBP0: color1→shade1");
            assertEquals<u8>(getPixel(8), expectedShade(1, 0x18), "OBP1: color1→shade2");
        });

        it("X-flip mirrors sprite horizontally", () => {
            setupSprites(0x82);
            // Tile row 0: leftmost pixel (bit7) = color3, rest = color1
            // lo=0xFF (all LSBs set), hi=0x80 (only bit7 MSB set) → pixel0=color3, pixels1-7=color1
            setTileRow(0, 0, 0xFF, 0x80);
            setOamEntry(0, 16,  8, 0, 0x00); // sprite A: no flip at x=0
            setOamEntry(1, 16, 16, 0, 0x20); // sprite B: X-flip at x=8
            renderLine(0);
            const c1 = expectedShade(1, 0xE4);
            const c3 = expectedShade(3, 0xE4);
            assertEquals<u8>(getPixel(0), c3, "no-flip: leftmost pixel = color3");
            assertEquals<u8>(getPixel(7), c1, "no-flip: rightmost pixel = color1");
            assertEquals<u8>(getPixel(8), c1, "x-flip: leftmost pixel = color1 (was rightmost)");
            assertEquals<u8>(getPixel(15), c3, "x-flip: rightmost pixel = color3 (was leftmost)");
        });

        it("Y-flip mirrors sprite vertically", () => {
            setupSprites(0x82);
            // Tile: row 0 = all color3, rows 1-7 = all color1
            setTileRow(0, 0, 0xFF, 0xFF); // row 0 all color3
            for (let r: u8 = 1; r < 8; r++) setTileRow(0, r, 0xFF, 0x00); // rows 1-7 all color1
            setOamEntry(0, 16,  8, 0, 0x00); // sprite A: no Y-flip
            setOamEntry(1, 16, 16, 0, 0x40); // sprite B: Y-flip
            // LY=0: no-flip → row 0 = color3; y-flip → row (8-1-0)=7 = color1
            renderLine(0);
            assertEquals<u8>(getPixel(0), expectedShade(3, 0xE4), "no y-flip LY=0 reads row 0 (color3)");
            assertEquals<u8>(getPixel(8), expectedShade(1, 0xE4), "y-flip LY=0 reads row 7 (color1)");
        });

        it("BG-over-sprite priority: BG colors 1-3 cover sprite", () => {
            setupSprites(0x93);
            store<u8>(GB_VIDEO_START + 0x1800, 1); // map → tile 1
            setTileSolid(0, 0xFF, 0x00); // sprite tile 0 all color1
            setTileSolid(1, 0xFF, 0xFF); // BG tile 1 all color3
            setOamEntry(0, 16, 8, 0, 0x80); // BGandWindowOver flag
            renderLine(0);
            assertEquals<u8>(getPixel(0), expectedShade(3, 0xE4), "BG color3 covers sprite");
        });

        it("BG-over-OBJ cascade: higher-priority sprite flag masks lower-priority sprite without flag", () => {
            setupSprites(0x93); // BG + OBJ
            store<u8>(GB_VIDEO_START + 0x1800, 2);
            setTileSolid(2, 0xFF, 0xFF); // BG tile 2 all color3
            setTileSolid(0, 0xFF, 0x00); // sprite tile 0 all color1
            setTileSolid(1, 0x00, 0xFF); // sprite tile 1 all color2
            // Sprite 0 (index 0, higher priority): BG-over-OBJ set
            // Sprite 1 (index 1, lower priority): no BG-over-OBJ flag
            // Both at xPos=8 (same pixels)
            setOamEntry(0, 16, 8, 0, 0x80);
            setOamEntry(1, 16, 8, 1, 0x00);
            renderLine(0);
            // Sprite 0 wins OBJ priority → has BG-over-OBJ + BG=color3 → BG wins
            // Sprite 1 is NOT shown even though it lacks the flag (no fallthrough)
            assertEquals<u8>(getPixel(0), expectedShade(3, 0xE4), "BG wins; lower-priority sprite without flag not shown");
        });

        it("BG-over-sprite priority: BG color 0 does NOT cover sprite", () => {
            setupSprites(0x93);
            store<u8>(GB_VIDEO_START + 0x1800, 5); // map → tile 5
            setTileSolid(5, 0x00, 0x00); // BG tile 5 all color 0 (transparent)
            setTileSolid(0, 0xFF, 0x00); // sprite tile 0 all color1
            setOamEntry(0, 16, 8, 0, 0x80); // BGandWindowOver flag
            renderLine(0);
            assertEquals<u8>(getPixel(0), expectedShade(1, 0xE4), "sprite visible when BG=0");
        });

        it("8x16 mode: top half renders tile (tileIndex & ~1)", () => {
            setupSprites(0x86); // PPU + OBJ + ObjSize8x16
            setTileSolid(0, 0xFF, 0xFF); // tile 0 all color3 (top half)
            setTileSolid(1, 0xFF, 0x00); // tile 1 all color1 (bottom half)
            setOamEntry(0, 16, 8, 0, 0);
            renderLine(0); // spriteY=0 → tile0 row0 → color3
            assertEquals<u8>(getPixel(0), expectedShade(3, 0xE4), "8x16 top half = tile 0");
        });

        it("8x16 mode: bottom half renders tile (tileIndex | 1)", () => {
            setupSprites(0x86);
            setTileSolid(0, 0xFF, 0xFF); // tile 0 all color3 (top)
            setTileSolid(1, 0xFF, 0x00); // tile 1 all color1 (bottom)
            setOamEntry(0, 16, 8, 0, 0);
            renderLine(8); // spriteY=8 → reads into tile1 row0 → color1; writes to buffer row 8
            assertEquals<u8>(getPixel(0, 8), expectedShade(1, 0xE4), "8x16 bottom half = tile 1");
        });

        it("8x16 mode: sprite spans 16 scanlines in OAM scan", () => {
            setupSprites(0x86);
            setOamEntry(0, 16, 8, 0, 0); // 8x16 sprite at y=0
            Lcd.setLY(15);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 1, "8x16 included at row 15");
            setupSprites(0x86);
            setOamEntry(0, 16, 8, 0, 0);
            Lcd.setLY(16);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 0, "8x16 excluded past row 15");
        });
    });

    // ── OBJ X-position limit counting ───────────────────────────────────────

    describe("OBJ X=0 and X>=168 hidden but count toward 10-limit", () => {

        it("X=0: off-screen sprites fill 10-limit, blocking visible 11th", () => {
            setupSprites();
            for (let i: u8 = 0; i < 10; i++) {
                setOamEntry(i, 16, 0, 0, 0); // Y overlaps LY=0, X=0 (screen x=-8)
            }
            setOamEntry(10, 16, 8, 0, 0); // 11th sprite visible at screen x=0
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 10, "X=0 sprites count: 11th excluded");
        });

        it("X=0: 11th sprite not rendered because limit hit by off-screen sprites", () => {
            setupSprites(0x82); // no BG
            setTileSolid(0, 0xFF, 0x00); // tile 0 all color 1
            for (let i: u8 = 0; i < 10; i++) {
                setOamEntry(i, 16, 0, 0, 0); // X=0 sprites consume limit
            }
            setOamEntry(10, 16, 8, 0, 0); // visible sprite at screen x=0
            renderLine(0);
            assertEquals<u8>(getPixel(0), 0, "11th sprite not rendered: limit hit by X=0 sprites");
        });

        it("X>=168: off-screen sprites fill 10-limit, blocking visible 11th", () => {
            setupSprites();
            for (let i: u8 = 0; i < 10; i++) {
                setOamEntry(i, 16, 168, 0, 0); // X=168 (screen x=160, off right edge)
            }
            setOamEntry(10, 16, 8, 0, 0);
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 10, "X=168 sprites count: 11th excluded");
        });
    });

    // ── OBJ Y-position limit counting ───────────────────────────────────────

    describe("OBJ Y=0 and Y>=160 hidden and do NOT count toward 10-limit", () => {

        it("Y=0: off-screen sprites excluded from scan, 11th visible sprite included", () => {
            setupSprites();
            for (let i: u8 = 0; i < 10; i++) {
                setOamEntry(i, 0, <u8>(8 + i * 8), 0, 0); // Y=0: screen y=-16, never overlaps
            }
            setOamEntry(10, 16, 8, 0, 0); // visible sprite
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 1, "Y=0 sprites not counted: visible 11th included");
        });

        it("Y=160: 8x8 sprite never overlaps scanlines 0-143, doesn't count", () => {
            setupSprites();
            for (let i: u8 = 0; i < 10; i++) {
                setOamEntry(i, 160, <u8>(8 + i * 8), 0, 0); // Y=160: screen y=144, off bottom
            }
            setOamEntry(10, 16, 8, 0, 0);
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 1, "Y=160 sprites not counted: visible 11th included");
        });
    });

    // ── OBJ always uses $8000 unsigned addressing ────────────────────────────

    describe("OBJ always uses $8000 addressing regardless of LCDC.4", () => {

        it("LCDC.4=0 ($8800 BG mode): sprite tile 0 reads from $8000 block0, not $9000 block2", () => {
            // 0x82 = PPU + OBJ, no bit4 → BG would use $8800 signed, but OBJ ignores LCDC.4
            setupSprites(0x82);
            // tile 0 in block0 ($8000): all color 2 (lo=0x00, hi=0xFF)
            setTileSolid(0, 0x00, 0xFF);
            // conflicting data at $9000 (block2, where $8800 index 0 would map): all color 3
            for (let row: u8 = 0; row < 8; row++) {
                MemoryMap.GBstore<u8>(0x9000 + <u16>(row * 2),     0xFF);
                MemoryMap.GBstore<u8>(0x9000 + <u16>(row * 2 + 1), 0xFF);
            }
            setOamEntry(0, 16, 8, 0, 0);
            renderLine(0);
            // OBJ must use $8000 → color 2. Wrong ($9000) → color 3.
            assertEquals<u8>(getPixel(0), expectedShade(2, 0xE4), "OBJ tile 0 → $8000 → color 2, not $9000 color 3");
        });
    });

    // ── DMA interaction ───────────────────────────────────────────────────────

    describe("PPU OAM scan sees no sprites during active DMA", () => {
        it("FetchCurrentLine returns 0 sprites when DMA active", () => {
            setupSprites();
            // Baseline: sprite IS selected without DMA
            setOamEntry(0, 16, 8, 0, 0);
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 1, "baseline: sprite selected before DMA");

            // Re-init and trigger DMA before OAM scan
            setupSprites();
            setOamEntry(0, 16, 8, 0, 0);
            MemoryMap.GBstore<u8>(0xFF46, 0xC0); // trigger DMA from WRAM
            Lcd.setLY(0);
            PpuOamFifo.FetchCurrentLine();
            assertEquals<i32>(PpuOamFifo.size, 0, "no sprites selected during active DMA");
        });
    });

    return true;
}
