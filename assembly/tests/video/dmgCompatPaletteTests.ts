import { describe, it, assertEquals } from "../framework";
import { DmgCompatPalettes } from "../../cgb/dmgCompatPalettes";
import { Cartridge } from "../../cartridge";
import { CARTRIDGE_ROM_START, GB_CGB_PALETTE_RAM_START } from "../../memory/memoryConstants";

const OBJ_OFFSET: u32 = 64;

function writeTitle(title: string): void {
    const titleBase: u32 = CARTRIDGE_ROM_START + 0x134;
    // Zero title region first.
    for (let i: u32 = 0; i < 16; i++) store<u8>(titleBase + i, 0);
    const len: i32 = title.length;
    for (let i: i32 = 0; i < len && i < 16; i++) {
        store<u8>(titleBase + <u32>i, <u8>title.charCodeAt(i));
    }
}

function setupNintendoCart(title: string): void {
    Cartridge.Data.oldLicenseeCode = 0x01;
    Cartridge.Data.newLicenseeCode = 0;
    writeTitle(title);
    // Clear palette RAM so we can verify writes.
    for (let i: u32 = 0; i < 128; i++) store<u8>(GB_CGB_PALETTE_RAM_START + i, 0);
}

function bgColor(idx: u32): u16 { return load<u16>(GB_CGB_PALETTE_RAM_START + idx * 2); }
function obj0Color(idx: u32): u16 { return load<u16>(GB_CGB_PALETTE_RAM_START + OBJ_OFFSET + idx * 2); }
function obj1Color(idx: u32): u16 { return load<u16>(GB_CGB_PALETTE_RAM_START + OBJ_OFFSET + 8 + idx * 2); }

export function testDmgCompatPalettes(): boolean {
    describe("DmgCompatPalettes — palette code resolution", () => {

        it("non-Nintendo cart returns code 0", () => {
            Cartridge.Data.oldLicenseeCode = 0xA4;
            Cartridge.Data.newLicenseeCode = 0;
            writeTitle("");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 0, "non-Nintendo → default");
        });

        it("new-licensee Nintendo (0x33 + '01') is honored", () => {
            Cartridge.Data.oldLicenseeCode = 0x33;
            Cartridge.Data.newLicenseeCode = 0x3130;
            writeTitle("TETRIS");
            // Tetris checksum 0xDB → palette code 3
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 3, "TETRIS palette code");
        });

        it("new-licensee non-Nintendo returns 0", () => {
            Cartridge.Data.oldLicenseeCode = 0x33;
            Cartridge.Data.newLicenseeCode = 0x3441; // "A4"
            writeTitle("TETRIS");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 0, "non-Nintendo new licensee → default");
        });

        it("TETRIS → palette code 3", () => {
            setupNintendoCart("TETRIS");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 3, "TETRIS");
        });

        it("ZELDA → palette code 44", () => {
            setupNintendoCart("ZELDA");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 44, "ZELDA");
        });

        it("DR.MARIO → palette code 15", () => {
            setupNintendoCart("DR.MARIO");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 15, "DR.MARIO");
        });

        it("ALLEY WAY → palette code 4", () => {
            setupNintendoCart("ALLEY WAY");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 4, "ALLEY WAY");
        });

        it("4th-letter dup: POKEMON BLUE → code 11", () => {
            setupNintendoCart("POKEMON BLUE");
            // checksum 0x61, 4th letter 'E' → palette code 11
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 11, "POKEMON BLUE (dup-zone match)");
        });

        it("4th-letter dup: POKEMON RED (non-dup checksum 0x14) → code 13", () => {
            setupNintendoCart("POKEMON RED");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 13, "POKEMON RED");
        });

        it("4th-letter dup: SUPER MARIOLAND → code 22", () => {
            setupNintendoCart("SUPER MARIOLAND");
            // checksum 0x46, 4th letter 'E' → palette code 22
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 22, "SUPER MARIOLAND");
        });

        it("4th-letter dup: GOLF → code 25", () => {
            setupNintendoCart("GOLF");
            // checksum 0x28, 4th letter 'F' → palette code 25
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 25, "GOLF");
        });

        it("4th-letter dup miss: unknown title with dup-zone checksum → 0", () => {
            // checksum 0xB3 has 3 dup entries with letters 'B','U','R'. Use 'X' to miss all.
            setupNintendoCart("XXX" + String.fromCharCode(0x58)); // 'X' as 4th letter
            // Synthesize title summing to 0xB3 by padding.
            // Easier: use existing dup checksum but mismatched 4th letter; we craft custom title.
            const titleBase: u32 = CARTRIDGE_ROM_START + 0x134;
            for (let i: u32 = 0; i < 16; i++) store<u8>(titleBase + i, 0);
            // Set first 4 bytes 'A','A','A','X', then add bytes summing to make total = 0xB3
            store<u8>(titleBase + 0, 0x41);
            store<u8>(titleBase + 1, 0x41);
            store<u8>(titleBase + 2, 0x41);
            store<u8>(titleBase + 3, 0x58); // 'X' — none of B/U/R
            // Sum so far: 0x41*3 + 0x58 = 0xC3 + 0x58 = 0x11B → low byte 0x1B; need 0xB3 total.
            // Add one more byte = (0xB3 - 0x1B) & 0xFF = 0x98
            store<u8>(titleBase + 4, 0x98);
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 0, "dup-zone miss → default");
        });

        it("checksum miss (random title) → 0", () => {
            setupNintendoCart("UNKNOWN_GAME_1234");
            assertEquals<u8>(DmgCompatPalettes.getPaletteCode(), 0, "miss → default");
        });
    });

    describe("DmgCompatPalettes.Apply — palette injection", () => {

        it("default palette (code 0) writes BG palette index 0 colors", () => {
            // Default: combo[0] = (32, 32, 232) → Obj0=pal4, Obj1=pal4, Bg=pal29
            setupNintendoCart("UNKNOWN");
            DmgCompatPalettes.Apply();
            // pal29: 7FFF, 1BEF, 6180, 0000
            assertEquals<u16>(bgColor(0), 0x7FFF, "BG[0] pal29.color0");
            assertEquals<u16>(bgColor(1), 0x1BEF, "BG[1] pal29.color1");
            assertEquals<u16>(bgColor(2), 0x6180, "BG[2] pal29.color2");
            assertEquals<u16>(bgColor(3), 0x0000, "BG[3] pal29.color3");
            // pal4: 7FFF, 421F, 1CF2, 0000
            assertEquals<u16>(obj0Color(0), 0x7FFF, "OBJ0[0] pal4.color0");
            assertEquals<u16>(obj0Color(1), 0x421F, "OBJ0[1] pal4.color1");
            assertEquals<u16>(obj1Color(0), 0x7FFF, "OBJ1[0] pal4.color0");
            assertEquals<u16>(obj1Color(2), 0x1CF2, "OBJ1[2] pal4.color2");
        });

        it("TETRIS (code 3) → combo (24,24,24) = pal3 BG/OBJ0/OBJ1", () => {
            setupNintendoCart("TETRIS");
            DmgCompatPalettes.Apply();
            // combo 3 = (192,192,192) → all pal24
            // Wait: code=3 → combo[3] = (192,192,192). Palette at byte 192 = 192/8 = pal24.
            // pal24: 7FFF, 03FF, 001F, 0000
            assertEquals<u16>(bgColor(0), 0x7FFF, "TETRIS BG[0]");
            assertEquals<u16>(bgColor(1), 0x03FF, "TETRIS BG[1]");
            assertEquals<u16>(bgColor(2), 0x001F, "TETRIS BG[2]");
            assertEquals<u16>(obj0Color(1), 0x03FF, "TETRIS OBJ0[1]");
            assertEquals<u16>(obj1Color(2), 0x001F, "TETRIS OBJ1[2]");
        });

        it("POKEMON BLUE (code 11) → combo (32,224,224) = OBJ0 pal4, OBJ1 pal28, BG pal28", () => {
            setupNintendoCart("POKEMON BLUE");
            DmgCompatPalettes.Apply();
            // pal28: 7FFF, 7E8C, 7C00, 0000
            assertEquals<u16>(bgColor(0), 0x7FFF, "PKMN BLUE BG[0] pal28.color0");
            assertEquals<u16>(bgColor(1), 0x7E8C, "PKMN BLUE BG[1] pal28.color1");
            assertEquals<u16>(bgColor(2), 0x7C00, "PKMN BLUE BG[2] pal28.color2");
            // pal4: 7FFF, 421F, 1CF2, 0000
            assertEquals<u16>(obj0Color(1), 0x421F, "PKMN BLUE OBJ0[1] pal4.color1");
            // pal28
            assertEquals<u16>(obj1Color(1), 0x7E8C, "PKMN BLUE OBJ1[1] pal28.color1");
        });

        it("ZELDA (code 44) → combo (168,224,32) = OBJ0 pal21, OBJ1 pal28, BG pal4", () => {
            setupNintendoCart("ZELDA");
            DmgCompatPalettes.Apply();
            // pal4: 7FFF, 421F, 1CF2, 0000 → BG
            assertEquals<u16>(bgColor(0), 0x7FFF, "ZELDA BG[0] pal4.color0");
            assertEquals<u16>(bgColor(1), 0x421F, "ZELDA BG[1] pal4.color1");
            // pal21: 7FFF, 03E0, 0206, 0120 → OBJ0
            assertEquals<u16>(obj0Color(1), 0x03E0, "ZELDA OBJ0[1] pal21.color1");
            assertEquals<u16>(obj0Color(2), 0x0206, "ZELDA OBJ0[2] pal21.color2");
            // pal28 → OBJ1
            assertEquals<u16>(obj1Color(2), 0x7C00, "ZELDA OBJ1[2] pal28.color2");
        });

        it("DR.MARIO (code 15) → combo (224,32,224) = OBJ0 pal28, OBJ1 pal4, BG pal28", () => {
            setupNintendoCart("DR.MARIO");
            DmgCompatPalettes.Apply();
            // pal28 BG, pal28 OBJ0, pal4 OBJ1
            assertEquals<u16>(bgColor(2), 0x7C00, "DR.MARIO BG[2] pal28.color2");
            assertEquals<u16>(obj0Color(0), 0x7FFF, "DR.MARIO OBJ0[0] pal28.color0");
            assertEquals<u16>(obj1Color(1), 0x421F, "DR.MARIO OBJ1[1] pal4.color1");
        });

        it("non-Nintendo cart still applies palette code 0", () => {
            Cartridge.Data.oldLicenseeCode = 0xA4;
            Cartridge.Data.newLicenseeCode = 0;
            writeTitle("HOMEBREW");
            for (let i: u32 = 0; i < 128; i++) store<u8>(GB_CGB_PALETTE_RAM_START + i, 0);
            DmgCompatPalettes.Apply();
            // Default code 0 → pal29 BG, pal4 OBJ0, pal4 OBJ1
            assertEquals<u16>(bgColor(1), 0x1BEF, "non-Nintendo default BG[1] pal29.color1");
        });
    });

    return true;
}
