import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { Ppu, PpuOamFifo } from "../../io/video/ppu";
import { MemoryMap } from "../../memory/memoryMap";
import { CgbState } from "../../cgbState";
import { GB_VIDEO_START, GB_VIDEO_BANK_SIZE } from "../../memory/memoryConstants";
import { Oam } from "../../io/video/oam";
import { Cartridge } from "../../cartridge";
import { CGBMode } from "../../metadata";
import { describe, it, assertEquals } from "../framework";
import { setTestRom } from "../cpuTests";

const MAP_9800: u32 = GB_VIDEO_START + 0x1800;

const BCPS: u16 = 0xFF68;
const BCPD: u16 = 0xFF69;
const OCPS: u16 = 0xFF6A;
const OCPD: u16 = 0xFF6B;

const BGP_ADDR:  u16 = 0xFF47;
const OBP0_ADDR: u16 = 0xFF48;
const OBP1_ADDR: u16 = 0xFF49;

const RED:   u16 = 0x001F;
const GREEN: u16 = 0x03E0;
const BLUE:  u16 = 0x7C00;
const WHITE: u16 = 0x7FFF;
const YELLOW: u16 = 0x03FF;

// DMG-compat: DMG cart (cgbFlag=NonCGB) running in forced CGB mode (CgbState.isCgbMode=true).
function initDmgCompatPpu(): void {
    setTestRom([0x00]);
    Cartridge.Data.cgbFlag = CGBMode.NonCGB as u8;
    CgbState.setIsCGB(true);
    CgbState.setVramBank(0);
    MemoryMap.GBstore<u8>(0xFF40, 0x91);
    MemoryMap.GBstore<u8>(0xFF43, 0);
    MemoryMap.GBstore<u8>(0xFF42, 0);
    // Identity DMG palettes by default (BGP=0xE4: 0→0, 1→1, 2→2, 3→3)
    MemoryMap.GBstore<u8>(BGP_ADDR,  0xE4);
    MemoryMap.GBstore<u8>(OBP0_ADDR, 0xE4);
    MemoryMap.GBstore<u8>(OBP1_ADDR, 0xE4);
    PpuOamFifo.Reset();
}

function writeCgbSolidTile(tileIdx: u8, bank: u32, colorId: u8): void {
    const lsb: u8 = (colorId & 1) != 0 ? 0xFF : 0x00;
    const msb: u8 = (colorId & 2) != 0 ? 0xFF : 0x00;
    const prevBank = CgbState.vramBank;
    CgbState.setVramBank(bank);
    const gbBase: u16 = 0x8000 + <u16>tileIdx * 16;
    for (let row: u32 = 0; row < 8; row++) {
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     lsb);
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), msb);
    }
    CgbState.setVramBank(prevBank);
}

function setMapEntry(tileX: u8, tileY: u8, tileIndex: u8, attrs: u8): void {
    const offset: u32 = <u32>tileX + <u32>tileY * 32;
    store<u8>(MAP_9800 + offset, tileIndex);
    store<u8>(MAP_9800 + GB_VIDEO_BANK_SIZE + offset, attrs);
}

function setCgbBgColor(paletteNum: u8, colorIdx: u8, rgb555: u16): void {
    const idx: u8 = paletteNum * 8 + colorIdx * 2;
    MemoryMap.GBstore<u8>(BCPS, idx);
    MemoryMap.GBstore<u8>(BCPD, <u8>rgb555);
    MemoryMap.GBstore<u8>(BCPS, idx + 1);
    MemoryMap.GBstore<u8>(BCPD, <u8>(rgb555 >> 8));
}

function setCgbObjColor(paletteNum: u8, colorIdx: u8, rgb555: u16): void {
    const idx: u8 = paletteNum * 8 + colorIdx * 2;
    MemoryMap.GBstore<u8>(OCPS, idx);
    MemoryMap.GBstore<u8>(OCPD, <u8>rgb555);
    MemoryMap.GBstore<u8>(OCPS, idx + 1);
    MemoryMap.GBstore<u8>(OCPD, <u8>(rgb555 >> 8));
}

function assertCgbPixel(x: u8, expected: u16, label: string): void {
    const actual = load<u16>(Ppu.cgbWorkingBufferPtr + (<u32>x) * 2);
    assertEquals<u16>(actual, expected, label);
}

export function testDmgCompatRendering(): boolean {
    describe("DMG-compat in forced CGB — BG attribute byte ignored", () => {

        it("BG palette attr is ignored; always uses CGB BG palette 0", () => {
            initDmgCompatPpu();
            writeCgbSolidTile(0, 0, 1);
            // Two tile slots both use tile 0 but with different palette attrs
            setMapEntry(0, 0, 0, 0x01);  // attr palette=1 (should be ignored)
            setMapEntry(1, 0, 0, 0x07);  // attr palette=7 (should be ignored)
            setCgbBgColor(0, 1, RED);    // palette 0 — what we expect
            setCgbBgColor(1, 1, BLUE);   // palette 1 — must NOT be used
            setCgbBgColor(7, 1, GREEN);  // palette 7 — must NOT be used
            ScanlineRenderer.Render();
            assertCgbPixel(0,  RED, "tile-attr palette 1 ignored → BG pal 0");
            assertCgbPixel(8,  RED, "tile-attr palette 7 ignored → BG pal 0");
        });

        it("BG vramBank attr is ignored; always reads tile data from bank 0", () => {
            initDmgCompatPpu();
            writeCgbSolidTile(0, 0, 1);  // bank 0, tile 0 = colorId 1
            writeCgbSolidTile(0, 1, 2);  // bank 1, tile 0 = colorId 2 (must NOT be used)
            setMapEntry(0, 0, 0, 0x08);  // attr bank=1
            setCgbBgColor(0, 1, RED);
            setCgbBgColor(0, 2, GREEN);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED, "tile-attr bank=1 ignored → bank 0 used → colorId 1 = RED");
        });

        it("BG hFlip attr is ignored", () => {
            initDmgCompatPpu();
            // Tile: pixel 0 = colorId 1, pixels 1..7 = colorId 0
            CgbState.setVramBank(0);
            const gbBase: u16 = 0x8000;
            for (let row: u32 = 0; row < 8; row++) {
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     0x80);
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), 0x00);
            }
            setMapEntry(0, 0, 0, 0x20); // attr hFlip=1 (must be ignored)
            setCgbBgColor(0, 0, BLUE);
            setCgbBgColor(0, 1, RED);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,  "no flip: pixel 0 = colorId 1 = RED");
            assertCgbPixel(7, BLUE, "no flip: pixel 7 = colorId 0 = BLUE");
        });

        it("BG vFlip attr is ignored", () => {
            initDmgCompatPpu();
            // Row 0 = colorId 1, rows 1-7 = colorId 0
            CgbState.setVramBank(0);
            const gbBase: u16 = 0x8000;
            MemoryMap.GBstore<u8>(gbBase + 0, 0xFF);
            MemoryMap.GBstore<u8>(gbBase + 1, 0x00);
            for (let row: u32 = 1; row < 8; row++) {
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     0x00);
                MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), 0x00);
            }
            setMapEntry(0, 0, 0, 0x40); // attr vFlip=1 (must be ignored)
            setCgbBgColor(0, 0, BLUE);
            setCgbBgColor(0, 1, RED);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED, "no flip: LY=0 reads row 0 = colorId 1 = RED");
        });
    });

    describe("DMG-compat in forced CGB — BG color goes through BGP", () => {

        it("BGP=0x00 maps every colorId to BG pal 0 color 0", () => {
            initDmgCompatPpu();
            writeCgbSolidTile(0, 0, 1);
            setMapEntry(0, 0, 0, 0x00);
            MemoryMap.GBstore<u8>(BGP_ADDR, 0x00);
            setCgbBgColor(0, 0, BLUE);
            setCgbBgColor(0, 1, RED);
            ScanlineRenderer.Render();
            assertCgbPixel(0, BLUE, "BGP=0x00 → colorId 1 → idx 0 → BLUE");
        });

        it("BGP=0x1B (inverted) remaps colorIds before pal lookup", () => {
            // BGP 0b00011011 → ci=0→3, ci=1→2, ci=2→1, ci=3→0
            initDmgCompatPpu();
            writeCgbSolidTile(0, 0, 1);  // tile = colorId 1
            writeCgbSolidTile(1, 0, 2);  // tile = colorId 2
            setMapEntry(0, 0, 0, 0x00);
            setMapEntry(1, 0, 1, 0x00);
            MemoryMap.GBstore<u8>(BGP_ADDR, 0x1B);
            setCgbBgColor(0, 0, BLUE);
            setCgbBgColor(0, 1, GREEN);
            setCgbBgColor(0, 2, RED);
            setCgbBgColor(0, 3, WHITE);
            ScanlineRenderer.Render();
            assertCgbPixel(0, RED,   "BGP=0x1B: colorId 1 → idx 2 → RED");
            assertCgbPixel(8, GREEN, "BGP=0x1B: colorId 2 → idx 1 → GREEN");
        });
    });

    describe("DMG-compat in forced CGB — sprite palette via OAM bit 4", () => {

        it("OAM bit 4 = 0 selects OBJ pal 0 (OBP0 slot)", () => {
            initDmgCompatPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93); // sprites enabled
            // BG color 0 = WHITE (bg behind sprite)
            writeCgbSolidTile(0, 0, 0);
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 0, WHITE);

            writeCgbSolidTile(1, 0, 1);    // sprite colorId 1
            setCgbObjColor(0, 1, RED);     // OBJ pal 0 color 1 = RED
            setCgbObjColor(1, 1, BLUE);    // OBJ pal 1 — must NOT be used

            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x00; // bit4=0 → OBP0
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, RED, "bit4=0 → OBJ pal 0 → RED");
        });

        it("OAM bit 4 = 1 selects OBJ pal 1 (OBP1 slot)", () => {
            initDmgCompatPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            writeCgbSolidTile(0, 0, 0);
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 0, WHITE);

            writeCgbSolidTile(1, 0, 1);
            setCgbObjColor(0, 1, RED);
            setCgbObjColor(1, 1, BLUE);

            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x10; // bit4=1 → OBP1
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, BLUE, "bit4=1 → OBJ pal 1 → BLUE");
        });

        it("OAM bits 0-2 (CGB pal index) are ignored for sprite palette", () => {
            initDmgCompatPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            writeCgbSolidTile(0, 0, 0);
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 0, WHITE);

            writeCgbSolidTile(1, 0, 1);
            setCgbObjColor(0, 1, RED);     // OBJ pal 0 color 1 = RED (expected)
            setCgbObjColor(7, 1, GREEN);   // OBJ pal 7 — must NOT be used

            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x07; // CGB pal=7, bit4=0 → DMG pal=OBP0
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, RED, "CGB pal bits ignored → OBP0 (pal 0) → RED");
        });
    });

    describe("DMG-compat in forced CGB — sprite color goes through OBP0/OBP1", () => {

        it("OBP0=0xFF maps every colorId to OBJ pal 0 color 3", () => {
            initDmgCompatPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            writeCgbSolidTile(0, 0, 0);
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 0, WHITE);

            writeCgbSolidTile(1, 0, 1);    // sprite colorId 1
            setCgbObjColor(0, 1, RED);     // would-be result without indirection
            setCgbObjColor(0, 3, GREEN);   // OBP0=0xFF → idx 3 → GREEN

            MemoryMap.GBstore<u8>(OBP0_ADDR, 0xFF);
            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x00;
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, GREEN, "OBP0=0xFF: colorId 1 → idx 3 → GREEN");
        });

        it("OBP1 indirection independent of OBP0", () => {
            initDmgCompatPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            writeCgbSolidTile(0, 0, 0);
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 0, WHITE);

            writeCgbSolidTile(1, 0, 1);
            setCgbObjColor(1, 1, RED);     // would-be result without indirection
            setCgbObjColor(1, 2, YELLOW);  // OBP1 result via indirection

            MemoryMap.GBstore<u8>(OBP0_ADDR, 0xE4);  // identity (must not affect)
            MemoryMap.GBstore<u8>(OBP1_ADDR, 0x08);  // ci=1 → (0x08>>2)&3 = 2

            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x10; // OBP1
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, YELLOW, "OBP1=0x08: colorId 1 → idx 2 → YELLOW");
        });

        it("sprite colorId 0 stays transparent regardless of OBPx", () => {
            initDmgCompatPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            writeCgbSolidTile(0, 0, 1);    // BG colorId 1
            setMapEntry(0, 0, 0, 0x00);
            setCgbBgColor(0, 1, BLUE);

            writeCgbSolidTile(1, 0, 0);    // sprite all colorId 0
            setCgbObjColor(0, 0, RED);
            MemoryMap.GBstore<u8>(OBP0_ADDR, 0xFF); // would map ci=0 → idx 3, but ci=0 is transparent

            Oam.view[0].xPos = 8;
            Oam.view[0].yPos = 16;
            Oam.view[0].tileIndex = 1;
            Oam.view[0].flags = 0x00;
            PpuOamFifo.FetchCurrentLine();

            ScanlineRenderer.Render();
            assertCgbPixel(0, BLUE, "sprite colorId 0 transparent → BG visible");
        });
    });

    describe("DMG-compat does NOT trigger when CGB cart in forced CGB", () => {

        it("CGB cart honors tile-attr palette as usual", () => {
            setTestRom([0x00]);
            Cartridge.Data.cgbFlag = CGBMode.CGBOnly as u8;
            CgbState.setIsCGB(true);
            CgbState.setVramBank(0);
            MemoryMap.GBstore<u8>(0xFF40, 0x91);
            MemoryMap.GBstore<u8>(0xFF43, 0);
            MemoryMap.GBstore<u8>(0xFF42, 0);
            MemoryMap.GBstore<u8>(BGP_ADDR, 0x00); // BGP irrelevant in true CGB
            PpuOamFifo.Reset();

            writeCgbSolidTile(0, 0, 1);
            setMapEntry(0, 0, 0, 0x01); // attr palette=1 (must be honored)
            setCgbBgColor(0, 1, RED);
            setCgbBgColor(1, 1, BLUE);
            ScanlineRenderer.Render();
            assertCgbPixel(0, BLUE, "CGB cart: attr palette=1 honored → BLUE");
        });
    });

    return true;
}
