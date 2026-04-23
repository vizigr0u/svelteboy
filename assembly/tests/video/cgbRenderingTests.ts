import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { Ppu, PpuOamFifo } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { CgbState } from "../../cgbState";
import { GB_VIDEO_START, GB_VIDEO_BANK_SIZE } from "../../memory/memoryConstants";
import { Oam } from "../../io/video/oam";
import { describe, it, assertEquals } from "../framework";
import { setTestRom } from "../cpuTests";

const MAP_9800: u32 = GB_VIDEO_START + 0x1800;

const BCPS: u16 = 0xFF68;
const BCPD: u16 = 0xFF69;
const OCPS: u16 = 0xFF6A;
const OCPD: u16 = 0xFF6B;

// RGB555 test colors
const RED:   u16 = 0x001F; // R=31 G=0  B=0
const GREEN: u16 = 0x03E0; // R=0  G=31 B=0
const BLUE:  u16 = 0x7C00; // R=0  G=0  B=31
const WHITE: u16 = 0x7FFF; // R=31 G=31 B=31

function initCgbPpu(): void {
    setTestRom([0x00]);
    CgbState.setIsCGB(true);
    CgbState.setVramBank(0);
    MemoryMap.GBstore<u8>(0xFF40, 0x91); // PPU on, TILE_$8000, BG on, no sprites
    MemoryMap.GBstore<u8>(0xFF43, 0);    // SCX=0
    MemoryMap.GBstore<u8>(0xFF42, 0);    // SCY=0
    PpuOamFifo.Reset();
}

// Write all 8 rows of a solid-color tile to VRAM bank `bank`, tile index `tileIdx`.
function writeCgbSolidTile(tileIdx: u8, bank: u32, colorId: u8): void {
    const lsb: u8 = (colorId & 1) != 0 ? 0xFF : 0x00;
    const msb: u8 = (colorId & 2) != 0 ? 0xFF : 0x00;
    CgbState.setVramBank(bank);
    const gbBase: u16 = 0x8000 + <u16>tileIdx * 16;
    for (let row: u32 = 0; row < 8; row++) {
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     lsb);
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), msb);
    }
    CgbState.setVramBank(0);
}

// Write tile index into the 32×32 map at (tileX, tileY), and attributes into VRAM bank 1 same slot.
// attrs: bits 2:0=palette, bit3=vramBank, bit5=hFlip, bit6=vFlip, bit7=bgPrio
function setMapEntry(tileX: u8, tileY: u8, tileIndex: u8, attrs: u8): void {
    const offset: u32 = <u32>tileX + <u32>tileY * 32;
    store<u8>(MAP_9800 + offset, tileIndex);                       // tile index in VRAM bank 0
    store<u8>(MAP_9800 + GB_VIDEO_BANK_SIZE + offset, attrs);      // attributes in VRAM bank 1
}

// Write an RGB555 color into the CGB BG palette RAM via BCPS/BCPD.
function setCgbBgColor(paletteNum: u8, colorIdx: u8, rgb555: u16): void {
    const idx: u8 = paletteNum * 8 + colorIdx * 2;
    MemoryMap.GBstore<u8>(BCPS, idx);
    MemoryMap.GBstore<u8>(BCPD, <u8>rgb555);
    MemoryMap.GBstore<u8>(BCPS, idx + 1);
    MemoryMap.GBstore<u8>(BCPD, <u8>(rgb555 >> 8));
}

// Write an RGB555 color into the CGB OBJ palette RAM via OCPS/OCPD.
function setCgbObjColor(paletteNum: u8, colorIdx: u8, rgb555: u16): void {
    const idx: u8 = paletteNum * 8 + colorIdx * 2;
    MemoryMap.GBstore<u8>(OCPS, idx);
    MemoryMap.GBstore<u8>(OCPD, <u8>rgb555);
    MemoryMap.GBstore<u8>(OCPS, idx + 1);
    MemoryMap.GBstore<u8>(OCPD, <u8>(rgb555 >> 8));
}

function assertCgbPixelAt(x: u8, y: u8, expected: u16, label: string): void {
    const actual = load<u16>(Ppu.cgbWorkingBufferPtr + (<u32>x + <u32>y * 160) * 2);
    assertEquals<u16>(actual, expected, label);
}

function assertCgbPixel(x: u8, expected: u16, label: string): void {
    assertCgbPixelAt(x, 0, expected, label);
}

export function testCgbRendering(): boolean {
    describe("CGB BG rendering — basic color output", () => {

        it("solid tile color 1 maps to palette 0 color 1 (RED)", () => {
            initCgbPpu();
            writeCgbSolidTile(0, 0, 1);      // tile 0, bank 0, all pixels = colorId 1
            setMapEntry(0, 0, 0, 0x00);       // tile 0, attrs: palette 0, bank 0
            setCgbBgColor(0, 1, RED);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED, "pixel 0 = RED");
            assertCgbPixel(7, RED, "pixel 7 = RED (same tile)");
        });

        it("solid tile color 0 maps to palette 0 color 0", () => {
            initCgbPpu();
            writeCgbSolidTile(0, 0, 0);      // colorId 0
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 0, WHITE);
            ScanlineRenderer.Render();
            assertCgbPixel(0, WHITE, "colorId 0 → palette 0 color 0 = WHITE");
        });

        it("adjacent tiles use independent palette colors", () => {
            initCgbPpu();
            writeCgbSolidTile(0, 0, 1);
            writeCgbSolidTile(1, 0, 2);
            setMapEntry(0, 0, 0, 0x00);    // tile 0, palette 0
            setMapEntry(1, 0, 1, 0x00);    // tile 1, palette 0
            setCgbBgColor(0, 1, RED);
            setCgbBgColor(0, 2, GREEN);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,   "tile 0 pixel 0 = RED (colorId 1)");
            assertCgbPixel(7, RED,   "tile 0 pixel 7 = RED");
            assertCgbPixel(8, GREEN, "tile 1 pixel 0 = GREEN (colorId 2)");
            assertCgbPixel(15, GREEN,"tile 1 pixel 7 = GREEN");
        });

    });

    describe("CGB BG rendering — tile attributes", () => {

        it("palette attribute selects correct CGB palette", () => {
            initCgbPpu();
            writeCgbSolidTile(0, 0, 1);
            setMapEntry(0, 0, 0, 0x01);    // attrs: palette 1
            setMapEntry(1, 0, 0, 0x02);    // attrs: palette 2 (same tile 0)
            setCgbBgColor(0, 1, WHITE);    // palette 0 unused
            setCgbBgColor(1, 1, RED);      // palette 1 color 1 = RED
            setCgbBgColor(2, 1, GREEN);    // palette 2 color 1 = GREEN
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,   "col 0 uses palette 1 = RED");
            assertCgbPixel(8, GREEN, "col 1 uses palette 2 = GREEN");
        });

        it("vramBank=1 attribute reads tile data from VRAM bank 1", () => {
            initCgbPpu();
            writeCgbSolidTile(0, 0, 1); // tile 0 in bank 0 = colorId 1
            writeCgbSolidTile(0, 1, 2); // tile 0 in bank 1 = colorId 2
            setMapEntry(0, 0, 0, 0x00); // col 0: tile 0, bank 0 → colorId 1 → RED
            setMapEntry(1, 0, 0, 0x08); // col 1: tile 0, bank 1 → colorId 2 → GREEN
            setCgbBgColor(0, 1, RED);
            setCgbBgColor(0, 2, GREEN);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,   "bank 0 tile 0 = RED");
            assertCgbPixel(8, GREEN, "bank 1 tile 0 = GREEN");
        });

        it("hFlip attribute reverses pixel order within tile", () => {
            initCgbPpu();
            // Tile with pixel 0 = colorId 1, pixels 1-7 = colorId 0
            // lo=0x80 (bit7 set), hi=0x00 → pixel uses bit (7-i): i=0→bit7=1→colorId1, i>0→0
            CgbState.setVramBank(0);
            const gbBase: u16 = 0x8000; // tile 0
            for (let row: u32 = 0; row < 8; row++) {
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     0x80); // lo
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), 0x00); // hi
            }
            setMapEntry(0, 0, 0, 0x00); // col 0: no flip → pixel 0=colorId1, pixels1-7=colorId0
            setMapEntry(1, 0, 0, 0x20); // col 1: hFlip  → pixel 0=colorId0, pixel 7=colorId1
            setCgbBgColor(0, 0, BLUE);
            setCgbBgColor(0, 1, RED);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,  "no-flip col: pixel 0 = RED (colorId 1)");
            assertCgbPixel(1, BLUE, "no-flip col: pixel 1 = BLUE (colorId 0)");
            assertCgbPixel(8, BLUE, "hFlip col: pixel 8 = BLUE (colorId 0, was pixel 7 unreversed)");
            assertCgbPixel(15, RED, "hFlip col: pixel 15 = RED (colorId 1, was pixel 0 unreversed)");
        });

        it("vFlip attribute reverses row order within tile", () => {
            initCgbPpu();
            // Tile with row 0 = colorId 1, rows 1-7 = colorId 0
            CgbState.setVramBank(0);
            const gbBase: u16 = 0x8000; // tile 0
            // row 0: lo=0xFF, hi=0x00 → all pixels = colorId 1
            MemoryMap.GBstore<u8>(gbBase + 0, 0xFF);
            MemoryMap.GBstore<u8>(gbBase + 1, 0x00);
            // rows 1-7: lo=0x00, hi=0x00 → all pixels = colorId 0
            for (let row: u32 = 1; row < 8; row++) {
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     0x00);
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), 0x00);
            }
            setMapEntry(0, 0, 0, 0x00); // col 0: no vFlip  → LY=0 reads row 0 = colorId 1
            setMapEntry(1, 0, 0, 0x40); // col 1: vFlip=1 → LY=0 reads row 7 = colorId 0
            setCgbBgColor(0, 0, BLUE);
            setCgbBgColor(0, 1, RED);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,  "no-vFlip: LY=0 uses tile row 0 = RED");
            assertCgbPixel(8, BLUE, "vFlip: LY=0 uses tile row 7 (flipped) = BLUE");
        });

        it("bgPriority flag is stored per pixel (used in sprite compositing)", () => {
            initCgbPpu();
            // We can't directly read bgPriority, but enable sprites and confirm priority works.
            // Tile with colorId 1 (non-transparent), bg priority attr set.
            // Sprite over same pixel: OBJ should lose to BG when bgPrio=1 && bgColorId!=0.
            MemoryMap.GBstore<u8>(0xFF40, 0x93); // PPU on, TILE_$8000, sprites enabled, BG on
            writeCgbSolidTile(0, 0, 1);   // BG tile 0 = colorId 1
            setMapEntry(0, 0, 0, 0x80);   // attrs: bgPrio=1
            setCgbBgColor(0, 1, RED);     // BG palette 0 color 1 = RED

            writeCgbSolidTile(1, 0, 3);   // sprite tile 1 = colorId 3
            setCgbObjColor(0, 3, GREEN);  // OBJ palette 0 color 3 = GREEN

            // Place sprite at x=8, y=16 so it overlaps LY=0 at screen x=0..7
            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x00; // OBJ palette 0, no bgPrio
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            // BG has priority, colorId=1 != 0, so BG wins over sprite
            assertCgbPixel(0, RED, "bgPrio=1: BG (RED) wins over sprite (GREEN)");
        });

    });

    describe("CGB sprite rendering", () => {

        it("sprite (OBJ) renders over BG when no priority flags set", () => {
            initCgbPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93); // sprites enabled
            writeCgbSolidTile(0, 0, 1);   // BG tile colorId 1
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 1, BLUE);    // BG = BLUE

            writeCgbSolidTile(1, 0, 2);   // sprite tile colorId 2
            setCgbObjColor(0, 2, RED);    // OBJ = RED

            Oam.view[0].xPos = 8;   // x=8 → screen pixels 0..7
            Oam.view[0].yPos = 16;  // y=16 → LY=0
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x00;
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,  "sprite (RED) draws over BG (BLUE)");
            assertCgbPixel(8, BLUE, "outside sprite → BG (BLUE)");
        });

        it("sprite color 0 is transparent (BG shows through)", () => {
            initCgbPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            writeCgbSolidTile(0, 0, 1);
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 1, BLUE);

            writeCgbSolidTile(1, 0, 0);   // sprite = all colorId 0 (transparent)
            setCgbObjColor(0, 0, RED);

            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x00;
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, BLUE, "sprite colorId 0 is transparent → BG (BLUE) shows through");
        });

        it("sprite uses correct CGB OBJ palette", () => {
            initCgbPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            writeCgbSolidTile(0, 0, 0);   // BG = transparent (colorId 0)
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 0, BLUE);    // BG color 0 = BLUE (background)

            writeCgbSolidTile(1, 0, 1);   // sprite colorId 1
            setCgbObjColor(0, 1, RED);    // OBJ palette 0 color 1 = RED
            setCgbObjColor(1, 1, GREEN);  // OBJ palette 1 color 1 = GREEN

            // Sprite with OBJ palette 0 (flags bit2:0 = 0)
            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x00; // palette 0
            // Sprite with OBJ palette 1 (flags bit2:0 = 1)
            Oam.view[1].xPos = 16;
            Oam.view[1].yPos = 16;
            Oam.view[1].tileIndex = 1;
            Oam.view[1].flags = 0x01; // palette 1
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,   "OBJ palette 0 color 1 = RED");
            assertCgbPixel(8, GREEN, "OBJ palette 1 color 1 = GREEN");
        });

    });

    describe("CGB BG rendering — LY variants", () => {

        it("renders correct scanline when LY>0", () => {
            initCgbPpu();
            // Fill tile 0 with row-specific color: row 3 = colorId 2, others = colorId 1
            CgbState.setVramBank(0);
            const gbBase: u16 = 0x8000;
            for (let row: u32 = 0; row < 8; row++) {
                const colorId: u8 = row == 3 ? 2 : 1;
                const lsb: u8 = (colorId & 1) != 0 ? 0xFF : 0x00;
                const msb: u8 = (colorId & 2) != 0 ? 0xFF : 0x00;
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     lsb);
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), msb);
            }
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 1, RED);
            setCgbBgColor(0, 2, GREEN);

            // LY=3 should read tile row 3 → colorId 2 → GREEN
            Lcd.data.lY = 3;
            ScanlineRenderer.Render();
            assertCgbPixelAt(0, 3, GREEN, "LY=3 reads tile row 3 = GREEN");

            // LY=0 reads tile row 0 → colorId 1 → RED
            Lcd.data.lY = 0;
            ScanlineRenderer.Render();
            assertCgbPixelAt(0, 0, RED, "LY=0 reads tile row 0 = RED");
        });

    });

    return true;
}
