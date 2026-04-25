import { describe, it, assertEquals } from "../framework";
import { Ppu } from "../../io/video/ppu";
import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { MemoryMap } from "../../memory/memoryMap";
import { CARTRIDGE_ROM_START, GB_OAM_START, GB_VIDEO_START } from "../../memory/memoryConstants";
import { Emulator } from "../../emulator";
import { initPpu } from "./ppuTestHelpers";

const TILE_BLOCK0: u32 = GB_VIDEO_START;
const MAP_9800: u32 = GB_VIDEO_START + 0x1800;
const BGP_IDENTITY: u8 = 0xE4;

function writeSolidTile(wasmAddr: u32, colorId: u8): void {
    const lsb: u8 = (colorId & 1) != 0 ? 0xFF : 0x00;
    const msb: u8 = (colorId & 2) != 0 ? 0xFF : 0x00;
    const gbBase: u16 = <u16>(wasmAddr - GB_VIDEO_START + 0x8000);
    for (let row: u32 = 0; row < 8; row++) {
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2),     lsb);
        MemoryMap.GBstore<u8>(gbBase + <u16>(row * 2 + 1), msb);
    }
}

export function testFrameBuffer(): boolean {
    describe("Frame buffer format (1-byte-per-pixel shade indices)", () => {

        it("frame buffer pixel is shade index 0-3, not RGBA", () => {
            initPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x91); // PPU+TILE_8000+BG
            MemoryMap.GBstore<u8>(0xFF47, BGP_IDENTITY);
            writeSolidTile(TILE_BLOCK0, 2); // tile 0 → colorId 2
            store<u8>(MAP_9800, 0);         // map[0,0] = tile 0

            ScanlineRenderer.Render();

            const shade = load<u8>(Ppu.workingBufferPtr);
            assertEquals<u8>(shade, 2, "shade index should be 2 (not RGBA)");
            // RGBA for shade 2 would be at least 0x00000001; index must be 0-3
            assert(shade <= 3, "pixel value must be 0-3, not an RGBA word");
        });

        it("all 4 shade indices stored correctly for solid tiles", () => {
            for (let colorId: u8 = 0; colorId < 4; colorId++) {
                initPpu();
                MemoryMap.GBstore<u8>(0xFF40, 0x91);
                MemoryMap.GBstore<u8>(0xFF47, BGP_IDENTITY);
                writeSolidTile(TILE_BLOCK0, colorId);
                store<u8>(MAP_9800, 0);

                ScanlineRenderer.Render();

                const shade = load<u8>(Ppu.workingBufferPtr);
                assertEquals<u8>(shade, colorId, `solid colorId ${colorId} → shade ${colorId}`);
            }
        });

        it("BGP palette remapping reflected in stored shade index", () => {
            initPpu();
            MemoryMap.GBstore<u8>(0xFF40, 0x91);
            // BGP: colorId 1 → shade 3 (bits3-2 = 11 = 3; 0xFC = 11 11 11 00)
            // applyPalette(1, 0xFC) = (0xFC >> 2) & 3 = 0x3F & 3 = 3
            MemoryMap.GBstore<u8>(0xFF47, 0xFC);
            writeSolidTile(TILE_BLOCK0, 1); // colorId 1
            store<u8>(MAP_9800, 0);

            ScanlineRenderer.Render();

            const shade = load<u8>(Ppu.workingBufferPtr);
            assertEquals<u8>(shade, 3, "BGP maps colorId 1 → shade 3");
        });

        it("frame buffer size is 23040 bytes (160x144x1)", () => {
            initPpu();
            const buf = Ppu.DrawnBuffer();
            assertEquals<i32>(buf.byteLength, 160 * 144, "frame buffer is 23040 bytes");
        });
    });

    describe("Full-frame RunFrames(1) produces correct framebuffer", () => {

        it("single-frame run renders BG + sprite into DrawnBuffer", () => {
            // NOP sled so CPU doesn't touch VRAM/OAM during the frame
            memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
            MemoryMap.loadedCartridgeRomSize = 0x8000;
            Emulator.Init(false);

            // LCDC: PPU + TILE_LO + OBJ + BG
            MemoryMap.GBstore<u8>(0xFF40, 0x93);
            MemoryMap.GBstore<u8>(0xFF47, BGP_IDENTITY);   // BGP
            MemoryMap.GBstore<u8>(0xFF48, BGP_IDENTITY);   // OBP0

            // BG tile 0 = color 2 (all rows)
            for (let r: u16 = 0; r < 8; r++) {
                MemoryMap.GBstore<u8>(0x8000 + r * 2,     0x00);
                MemoryMap.GBstore<u8>(0x8000 + r * 2 + 1, 0xFF);
            }
            // Fill entire BG tilemap 9800 with tile 0 so every scanline has BG color2
            for (let i: u32 = 0; i < 32 * 32; i++) {
                store<u8>(GB_VIDEO_START + 0x1800 + i, 0);
            }

            // Sprite tile 1 = color 1 (all rows)
            for (let r: u16 = 0; r < 8; r++) {
                MemoryMap.GBstore<u8>(0x8010 + r * 2,     0xFF);
                MemoryMap.GBstore<u8>(0x8010 + r * 2 + 1, 0x00);
            }
            // OAM[0]: yPos=66 (screen y=50), xPos=58 (screen x=50), tile 1
            store<u8>(GB_OAM_START + 0, 66);
            store<u8>(GB_OAM_START + 1, 58);
            store<u8>(GB_OAM_START + 2, 1);
            store<u8>(GB_OAM_START + 3, 0);

            Emulator.RunFrames(1);

            const buf = Ppu.DrawnBuffer();
            assertEquals<i32>(buf.byteLength, 160 * 144, "buffer size");
            // BG outside sprite rectangle
            assertEquals<u8>(buf[0],                      2, "frame[0,0] = BG color2");
            assertEquals<u8>(buf[159],                    2, "frame[159,0] = BG color2");
            assertEquals<u8>(buf[143 * 160 + 0],          2, "frame[0,143] = BG color2");
            assertEquals<u8>(buf[143 * 160 + 159],        2, "frame[159,143] = BG color2");
            // Sprite rectangle x=50..57, y=50..57
            assertEquals<u8>(buf[50 * 160 + 50],          1, "frame[50,50] sprite color1");
            assertEquals<u8>(buf[50 * 160 + 57],          1, "frame[57,50] sprite color1");
            assertEquals<u8>(buf[57 * 160 + 50],          1, "frame[50,57] sprite color1");
            assertEquals<u8>(buf[57 * 160 + 57],          1, "frame[57,57] sprite color1");
            // Just outside sprite → BG
            assertEquals<u8>(buf[50 * 160 + 49],          2, "frame[49,50] BG color2");
            assertEquals<u8>(buf[50 * 160 + 58],          2, "frame[58,50] BG color2");
            assertEquals<u8>(buf[49 * 160 + 50],          2, "frame[50,49] BG color2");
            assertEquals<u8>(buf[58 * 160 + 50],          2, "frame[50,58] BG color2");
        });
    });

    return true;
}
