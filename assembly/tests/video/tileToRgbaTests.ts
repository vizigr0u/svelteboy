import { describe, it, assertEquals } from "../framework";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_VIDEO_START } from "../../memory/memoryConstants";
import { ScanlineRenderer } from "../../io/video/scanlineRenderer";
import { Ppu } from "../../io/video/ppu";
import { initPpu } from "./ppuTestHelpers";

// Helpers

function getPixel(x: u32): u8 {
    return load<u8>(Ppu.workingBufferPtr + x);
}

// Write two bytes to GB VRAM for tile 0, row 0 (via GBstore to update tile cache)
function writeTileRow0(lo: u8, hi: u8): void {
    MemoryMap.GBstore<u8>(0x8000, lo);
    MemoryMap.GBstore<u8>(0x8001, hi);
}

function setup2bpp(): void {
    initPpu();
    MemoryMap.GBstore<u8>(0xFF40, 0x91); // PPU + TILE_8000 + BG
    MemoryMap.GBstore<u8>(0xFF47, 0xE4); // BGP identity: colorId = shade
    MemoryMap.GBstore<u8>(0xFF43, 0);    // SCX=0
    MemoryMap.GBstore<u8>(0xFF42, 0);    // SCY=0
    store<u8>(GB_VIDEO_START + 0x1800, 0); // map[0,0] → tile 0
}

export function testTileToRgba(): void {
    describe("2bpp tile decoding", () => {

        // Spec: byte0=LSB plane, byte1=MSB plane, bit7=leftmost pixel
        // color index = {byte1_bit, byte0_bit}

        it("spec example: byte0=$3C byte1=$7E → row = 0,2,3,3,3,3,2,0", () => {
            // $3C = 00111100, $7E = 01111110
            // px0: b0.7=0, b1.7=0 → 0   px1: b0.6=0, b1.6=1 → 2
            // px2: b0.5=1, b1.5=1 → 3   px3: b0.4=1, b1.4=1 → 3
            // px4: b0.3=1, b1.3=1 → 3   px5: b0.2=1, b1.2=1 → 3
            // px6: b0.1=0, b1.1=1 → 2   px7: b0.0=0, b1.0=0 → 0
            setup2bpp();
            writeTileRow0(0x3C, 0x7E);
            ScanlineRenderer.Render();
            const expected: u8[] = [0, 2, 3, 3, 3, 3, 2, 0];
            for (let x: u32 = 0; x < 8; x++) {
                assertEquals<u8>(getPixel(x), expected[x], "spec example px" + x.toString());
            }
        });

        it("byte0=0xFF byte1=0xFF → all 8 pixels color 3 (both planes set)", () => {
            setup2bpp();
            writeTileRow0(0xFF, 0xFF);
            ScanlineRenderer.Render();
            for (let x: u32 = 0; x < 8; x++) {
                assertEquals<u8>(getPixel(x), 3, "FF/FF px" + x.toString() + " = color 3");
            }
        });

        it("byte0=0xFF byte1=0x00 → all 8 pixels color 1 (LSB plane only)", () => {
            setup2bpp();
            writeTileRow0(0xFF, 0x00);
            ScanlineRenderer.Render();
            for (let x: u32 = 0; x < 8; x++) {
                assertEquals<u8>(getPixel(x), 1, "FF/00 px" + x.toString() + " = color 1");
            }
        });

        it("byte0=0x00 byte1=0xFF → all 8 pixels color 2 (MSB plane only)", () => {
            setup2bpp();
            writeTileRow0(0x00, 0xFF);
            ScanlineRenderer.Render();
            for (let x: u32 = 0; x < 8; x++) {
                assertEquals<u8>(getPixel(x), 2, "00/FF px" + x.toString() + " = color 2");
            }
        });

        it("byte0=0x00 byte1=0x00 → all 8 pixels color 0", () => {
            setup2bpp();
            writeTileRow0(0x00, 0x00);
            ScanlineRenderer.Render();
            for (let x: u32 = 0; x < 8; x++) {
                assertEquals<u8>(getPixel(x), 0, "00/00 px" + x.toString() + " = color 0");
            }
        });

        it("byte0=0xAA byte1=0x55 → alternating color 1,2,1,2,1,2,1,2", () => {
            // $AA = 10101010, $55 = 01010101
            // px0: b0.7=1, b1.7=0 → 1   px1: b0.6=0, b1.6=1 → 2 ...
            setup2bpp();
            writeTileRow0(0xAA, 0x55);
            ScanlineRenderer.Render();
            const expected: u8[] = [1, 2, 1, 2, 1, 2, 1, 2];
            for (let x: u32 = 0; x < 8; x++) {
                assertEquals<u8>(getPixel(x), expected[x], "AA/55 px" + x.toString());
            }
        });

        it("bit7 of byte0/byte1 maps to leftmost pixel (px0)", () => {
            // Only bit7 set in each plane → px0=color3, rest=color0
            setup2bpp();
            writeTileRow0(0x80, 0x80);
            ScanlineRenderer.Render();
            assertEquals<u8>(getPixel(0), 3, "bit7 set → px0 = color 3");
            assertEquals<u8>(getPixel(1), 0, "bit6 clear → px1 = color 0");
        });

        it("bit0 of byte0/byte1 maps to rightmost pixel (px7)", () => {
            // Only bit0 set in each plane → px7=color3, rest=color0
            setup2bpp();
            writeTileRow0(0x01, 0x01);
            ScanlineRenderer.Render();
            assertEquals<u8>(getPixel(7), 3, "bit0 set → px7 = color 3");
            assertEquals<u8>(getPixel(6), 0, "bit1 clear → px6 = color 0");
        });
    });
}
