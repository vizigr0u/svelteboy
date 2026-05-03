// DMG-compat palette injection for DMG ROMs running in CGB mode.
//
// The checksum table, 4th-letter discriminators, palette codes, palette
// combinations, and RGB555 palette data below are ported from SameBoy's CGB
// boot ROM (BootROMs/cgb_boot.asm) at https://github.com/LIJI32/SameBoy.
//
// SameBoy is distributed under the Expat License (functionally identical to
// MIT). The notice required by that license is reproduced below; it covers
// the data tables in this file and any code derived from the SameBoy boot
// ROM's palette-selection algorithm.
//
// ----------------------------------------------------------------------------
// Copyright (c) 2015-2026 Lior Halphon
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
// ----------------------------------------------------------------------------

import { Cartridge } from "../cartridge";
import { CARTRIDGE_ROM_START, GB_CGB_PALETTE_RAM_START } from "../memory/memoryConstants";

const CGB_OBJ_PALETTE_OFFSET: u32 = 64;
const FIRST_DUP_INDEX: u32 = 65;
const TITLE_OFFSET: u32 = 0x134;
const FOURTH_LETTER_OFFSET: u32 = 0x137;
const TITLE_LEN: u32 = 16;
const NEW_LICENSEE_NINTENDO: u16 = 0x3130; // ASCII "01" little-endian
const OLD_LICENSEE_NEW_FLAG: u8 = 0x33;
const OLD_LICENSEE_NINTENDO: u8 = 0x01;

// 65 non-duplicate checksums + 29 duplicate-zone checksums = 94 entries.
const CHECKSUMS: StaticArray<u8> = [
    0x00, 0x88, 0x16, 0x36, 0xD1, 0xDB, 0xF2, 0x3C, 0x8C, 0x92, 0x3D, 0x5C, 0x58, 0xC9, 0x3E, 0x70,
    0x1D, 0x59, 0x69, 0x19, 0x35, 0xA8, 0x14, 0xAA, 0x75, 0x95, 0x99, 0x34, 0x6F, 0x15, 0xFF, 0x97,
    0x4B, 0x90, 0x17, 0x10, 0x39, 0xF7, 0xF6, 0xA2, 0x49, 0x4E, 0x43, 0x68, 0xE0, 0x8B, 0xF0, 0xCE,
    0x0C, 0x29, 0xE8, 0xB7, 0x86, 0x9A, 0x52, 0x01, 0x9D, 0x71, 0x9C, 0xBD, 0x5D, 0x6D, 0x67, 0x3F, 0x6B,
    // Duplicate zone (29 entries)
    0xB3, 0x46, 0x28, 0xA5, 0xC6, 0xD3, 0x27, 0x61, 0x18, 0x66, 0x6A, 0xBF, 0x0D, 0xF4, 0xB3,
    0x46, 0x28, 0xA5, 0xC6, 0xD3, 0x27, 0x61, 0x18, 0x66, 0x6A, 0xBF, 0x0D, 0xF4, 0xB3,
];

// 4th-letter discriminator for each duplicate-zone entry (string "BEFAARBEKEK R-URAR INAILICE R").
const FOURTH_LETTERS: StaticArray<u8> = [
    0x42, 0x45, 0x46, 0x41, 0x41, 0x52, 0x42, 0x45, 0x4B, 0x45, 0x4B, 0x20, 0x52, 0x2D, 0x55,
    0x52, 0x41, 0x52, 0x20, 0x49, 0x4E, 0x41, 0x49, 0x4C, 0x49, 0x43, 0x45, 0x20, 0x52,
];

// Palette code per checksum entry (high bit = "needs DMG tilemap" — ignored here).
const PALETTE_CODES: StaticArray<u8> = [
    0, 4, 5, 35, 34, 3, 31, 15, 10, 5, 19, 36, 7, 37, 30, 44,
    21, 32, 31, 20, 5, 33, 13, 14, 5, 29, 5, 18, 9, 3, 2, 26,
    25, 25, 41, 42, 26, 45, 42, 45, 36, 38, 26, 42, 30, 41, 34, 34,
    5, 42, 6, 5, 33, 25, 42, 42, 40, 2, 16, 25, 42, 42, 5, 0, 39,
    36, 22, 25, 6, 32, 12, 36, 11, 39, 18, 39, 24, 31, 50, 17,
    46, 6, 27, 0, 47, 41, 41, 0, 0, 19, 34, 23, 18, 29,
];

// 51 PaletteCombinations × 3 byte-offsets into PALETTES.
// palette_comb a,b,c → (a*8, b*8, c*8). raw_palette_comb a,b,c → (a*2, b*2, c*2).
const PALETTE_COMBOS: StaticArray<u8> = [
    /*  0 */  32,  32, 232,
    /*  1 */ 144, 144, 144,
    /*  2 */ 160, 160, 160,
    /*  3 */ 192, 192, 192,
    /*  4 */  72,  72,  72,
    /*  5 */   0,   0,   0,
    /*  6 */ 216, 216, 216,
    /*  7 */  40,  40,  40,
    /*  8 */  96,  96,  96,
    /*  9 */ 208, 208, 208,
    /* 10 */ 128,  64,  64,
    /* 11 */  32, 224, 224,
    /* 12 */  32,  16,  16,
    /* 13 */  24,  32,  32,
    /* 14 */  32, 232, 232,
    /* 15 */ 224,  32, 224,
    /* 16 */  16, 136,  16,
    /* 17 */ 128, 128,  64,
    /* 18 */  32,  32,  56,
    /* 19 */  32,  32, 144,
    /* 20 */  32,  32, 160,
    /* 21 */ 152, 152,  72,
    /* 22 */  30,  30,  88,    // raw
    /* 23 */ 136, 136,  16,
    /* 24 */  32,  32,  16,
    /* 25 */  32,  32,  24,
    /* 26 */ 224, 224,   0,
    /* 27 */  24,  24,   0,
    /* 28 */   0,   0,   8,
    /* 29 */ 144, 176, 144,
    /* 30 */ 160, 176, 160,
    /* 31 */ 192, 176, 192,
    /* 32 */ 128, 176,  64,
    /* 33 */ 136,  32, 104,
    /* 34 */ 222,   0, 112,    // raw
    /* 35 */ 222,  32, 120,    // raw
    /* 36 */ 152, 182,  72,    // raw
    /* 37 */ 128, 224,  80,
    /* 38 */  32, 184, 224,
    /* 39 */ 136, 176,  16,
    /* 40 */  32,   0,  16,
    /* 41 */  32, 224,  24,
    /* 42 */ 224,  24,   0,
    /* 43 */  24, 224,  32,
    /* 44 */ 168, 224,  32,
    /* 45 */  24, 224,   0,
    /* 46 */ 200,  24, 224,
    /* 47 */   0, 224,  64,
    /* 48 */  32,  24, 224,
    /* 49 */ 224,  24,  48,
    /* 50 */  32, 224, 232,
];

// 30 palettes × 4 colors × 2 bytes RGB555 little-endian.
const PALETTES: StaticArray<u8> = [
    /*  0 */ 0xFF,0x7F, 0xBF,0x32, 0xD0,0x00, 0x00,0x00,
    /*  1 */ 0x9F,0x63, 0x79,0x42, 0xB0,0x15, 0xCB,0x04,
    /*  2 */ 0xFF,0x7F, 0x31,0x6E, 0x4A,0x45, 0x00,0x00,
    /*  3 */ 0xFF,0x7F, 0xEF,0x1B, 0x00,0x02, 0x00,0x00,
    /*  4 */ 0xFF,0x7F, 0x1F,0x42, 0xF2,0x1C, 0x00,0x00,
    /*  5 */ 0xFF,0x7F, 0x94,0x52, 0x4A,0x29, 0x00,0x00,
    /*  6 */ 0xFF,0x7F, 0xFF,0x03, 0x2F,0x01, 0x00,0x00,
    /*  7 */ 0xFF,0x7F, 0xEF,0x03, 0xD6,0x01, 0x00,0x00,
    /*  8 */ 0xFF,0x7F, 0xB5,0x42, 0xC8,0x3D, 0x00,0x00,
    /*  9 */ 0x74,0x7E, 0xFF,0x03, 0x80,0x01, 0x00,0x00,
    /* 10 */ 0xFF,0x67, 0xAC,0x77, 0x13,0x1A, 0x6B,0x2D,
    /* 11 */ 0xD6,0x7E, 0xFF,0x4B, 0x75,0x21, 0x00,0x00,
    /* 12 */ 0xFF,0x53, 0x5F,0x4A, 0x52,0x7E, 0x00,0x00,
    /* 13 */ 0xFF,0x4F, 0xD2,0x7E, 0x4C,0x3A, 0xE0,0x1C,
    /* 14 */ 0xED,0x03, 0xFF,0x7F, 0x5F,0x25, 0x00,0x00,
    /* 15 */ 0x6A,0x03, 0x1F,0x02, 0xFF,0x03, 0xFF,0x7F,
    /* 16 */ 0xFF,0x7F, 0xDF,0x01, 0x12,0x01, 0x00,0x00,
    /* 17 */ 0x1F,0x23, 0x5F,0x03, 0xF2,0x00, 0x09,0x00,
    /* 18 */ 0xFF,0x7F, 0xEA,0x03, 0x1F,0x01, 0x00,0x00,
    /* 19 */ 0x9F,0x29, 0x1A,0x00, 0x0C,0x00, 0x00,0x00,
    /* 20 */ 0xFF,0x7F, 0x7F,0x02, 0x1F,0x00, 0x00,0x00,
    /* 21 */ 0xFF,0x7F, 0xE0,0x03, 0x06,0x02, 0x20,0x01,
    /* 22 */ 0xFF,0x7F, 0xEB,0x7E, 0x1F,0x00, 0x00,0x7C,
    /* 23 */ 0xFF,0x7F, 0xFF,0x3F, 0x00,0x7E, 0x1F,0x00,
    /* 24 */ 0xFF,0x7F, 0xFF,0x03, 0x1F,0x00, 0x00,0x00,
    /* 25 */ 0xFF,0x03, 0x1F,0x00, 0x0C,0x00, 0x00,0x00,
    /* 26 */ 0xFF,0x7F, 0x3F,0x03, 0x93,0x01, 0x00,0x00,
    /* 27 */ 0x00,0x00, 0x00,0x42, 0x7F,0x03, 0xFF,0x7F,
    /* 28 */ 0xFF,0x7F, 0x8C,0x7E, 0x00,0x7C, 0x00,0x00,
    /* 29 */ 0xFF,0x7F, 0xEF,0x1B, 0x80,0x61, 0x00,0x00,
];

@final
export class DmgCompatPalettes {
    @inline
    static getPaletteCode(): u8 {
        // Licensee gate: only Nintendo-published DMG carts get a matched palette.
        const oldLic: u8 = Cartridge.Data.oldLicenseeCode;
        if (oldLic == OLD_LICENSEE_NEW_FLAG) {
            if (Cartridge.Data.newLicenseeCode != NEW_LICENSEE_NINTENDO) return 0;
        } else if (oldLic != OLD_LICENSEE_NINTENDO) {
            return 0;
        }

        // Title checksum: sum of 16 bytes at $0134..$0143, low 8 bits.
        let sum: u32 = 0;
        const titleBase: u32 = CARTRIDGE_ROM_START + TITLE_OFFSET;
        for (let i: u32 = 0; i < TITLE_LEN; i++) {
            sum += <u32>load<u8>(titleBase + i);
        }
        const checksum: u8 = <u8>(sum & 0xFF);
        const fourthLetter: u8 = load<u8>(CARTRIDGE_ROM_START + FOURTH_LETTER_OFFSET);

        // Linear search; in dup zone also match 4th letter.
        const total: u32 = <u32>CHECKSUMS.length;
        for (let i: u32 = 0; i < total; i++) {
            if (CHECKSUMS[i] != checksum) continue;
            if (i < FIRST_DUP_INDEX) {
                return PALETTE_CODES[i];
            }
            if (FOURTH_LETTERS[i - FIRST_DUP_INDEX] == fourthLetter) {
                return PALETTE_CODES[i];
            }
        }
        return 0;
    }

    static Apply(): void {
        const code: u32 = <u32>DmgCompatPalettes.getPaletteCode() & 0x7F;
        const comboBase: u32 = code * 3;
        const obj0Off: u32 = <u32>PALETTE_COMBOS[comboBase + 0];
        const obj1Off: u32 = <u32>PALETTE_COMBOS[comboBase + 1];
        const bgOff: u32 = <u32>PALETTE_COMBOS[comboBase + 2];

        DmgCompatPalettes.copy8(GB_CGB_PALETTE_RAM_START, bgOff);
        DmgCompatPalettes.copy8(GB_CGB_PALETTE_RAM_START + CGB_OBJ_PALETTE_OFFSET, obj0Off);
        DmgCompatPalettes.copy8(GB_CGB_PALETTE_RAM_START + CGB_OBJ_PALETTE_OFFSET + 8, obj1Off);
    }

    @inline
    private static copy8(dest: u32, srcOff: u32): void {
        for (let i: u32 = 0; i < 8; i++) {
            store<u8>(dest + i, PALETTES[srcOff + i]);
        }
    }
}
