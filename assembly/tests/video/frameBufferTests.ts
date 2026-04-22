import { describe, it, assertEquals } from "../framework";
import { Ppu } from "../../io/video/ppu";
import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_VIDEO_START } from "../../memory/memoryConstants";
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
    return true;
}
