import { CartridgeType } from "../metadata";
import { isRamEnabled } from "../memory/mbcTypes";
import { MBC } from "../memory/mbc";
import { CARTRIDGE_ROM_START, ROM_BANK_SIZE, GB_EXT_RAM_START, GB_EXT_RAM_BANK_SIZE } from "../memory/memoryConstants";
import { SaveGame } from "../memory/savegame";
import { describe, it, assertEquals } from "./framework";
import { setupMBCCart, readRomBank0Sentinel, readRomBank1Sentinel, writeRam, readRam, mbcWrite } from "./mbcTestHelpers";

export function testMbc(): boolean {
    describe("No MBC (ROM only)", () => {

        it("ROM bank 0 window maps $0000 to CARTRIDGE_ROM_START", () => {
            setupMBCCart(CartridgeType.ROM_ONLY, 0, 0);
            assertEquals<u32>(MBC.MapRom(0x0000), CARTRIDGE_ROM_START, "MapRom(0x0000) = ROM start");
        });

        it("ROM bank 1 window maps $4000 to CARTRIDGE_ROM_START + 0x4000 (no switching)", () => {
            setupMBCCart(CartridgeType.ROM_ONLY, 0, 0);
            assertEquals<u32>(MBC.MapRom(0x4000), CARTRIDGE_ROM_START + 0x4000, "MapRom(0x4000) = ROM + 0x4000");
        });

        it("RAM always enabled on init", () => {
            setupMBCCart(CartridgeType.ROM_ONLY, 0, 2);
            assertEquals<bool>(isRamEnabled(), true, "RAM always enabled for no-MBC");
        });

        it("writes to ROM range are ignored (bank 1 window stays at physical bank 1)", () => {
            // 4-bank ROM: bank0=sentinel0, bank1=sentinel1, bank2=sentinel2, bank3=sentinel3.
            // Writing 3 to $2000 must NOT switch $4000 window to bank 3.
            setupMBCCart(CartridgeType.ROM_ONLY, 1, 0); // romSizeByte=1 → 4 banks
            mbcWrite(0x2000, 0x03); // attempt bank switch — must be ignored
            assertEquals<u8>(readRomBank1Sentinel(), 1, "$4000 still reads bank1 sentinel=1");
        });

    });

    describe("MBC1", () => {

        describe("RAM enable/disable", () => {
            it("enable RAM via write 0x0A to 0x0000", () => {
                setupMBCCart(CartridgeType.MBC1_RAM, 0, 2);
                mbcWrite(0x0000, 0x0A);
                assertEquals<bool>(isRamEnabled(), true, "RAM enabled");
            });

            it("disable RAM via write 0x00 to 0x0000", () => {
                setupMBCCart(CartridgeType.MBC1_RAM, 0, 2);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x0000, 0x00);
                assertEquals<bool>(isRamEnabled(), false, "RAM disabled");
            });
        });

        describe("ROM bank switching", () => {
            it("bank 0 write to 0x2000 remaps to bank 1", () => {
                setupMBCCart(CartridgeType.MBC1, 1, 0); // 4 banks
                mbcWrite(0x2000, 0x00);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank 0 → bank 1");
            });

            it("ROM bank select bits 0-4", () => {
                setupMBCCart(CartridgeType.MBC1, 3, 0); // 16 banks
                mbcWrite(0x2000, 5);
                assertEquals<u8>(readRomBank1Sentinel(), 5, "bank 5 selected");
            });

            it("ROM bank masked on 2-bank cart (mask=1)", () => {
                setupMBCCart(CartridgeType.MBC1, 0, 0); // 2 banks, mask=1
                mbcWrite(0x2000, 3); // 3 & mask(1) = 1
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank 3 masked to bank 1");
            });

            it("64-bank cart (>32) selects banks across full range without crash (regression)", () => {
                // Bug: assert(RomBankCount <= 32) fired for any cart with >32 banks (e.g. SML2: 64 banks)
                setupMBCCart(CartridgeType.MBC1, 5, 0); // romSizeByte=5 → 64 banks, mask=63
                mbcWrite(0x2000, 0x0F); // low=15 → bank 15
                assertEquals<u8>(readRomBank1Sentinel(), 15, "bank 15 accessible on 64-bank cart");
                mbcWrite(0x4000, 0x01); // high=1 → bank (1<<5)|15 = 47
                assertEquals<u8>(readRomBank1Sentinel(), 47, "bank 47 accessible on 64-bank cart");
                mbcWrite(0x2000, 0x1F); // low=31 → bank (1<<5)|31 = 63
                assertEquals<u8>(readRomBank1Sentinel(), 63, "bank 63 (max) accessible on 64-bank cart");
            });

            it("MapRom bank 0 range fixed in simple mode", () => {
                setupMBCCart(CartridgeType.MBC1, 1, 0); // 4 banks
                assertEquals<u8>(readRomBank0Sentinel(), 0, "rom0 sentinel = 0");
            });
        });

        describe("high register (0x4000-0x5FFF) in simple mode", () => {
            it("shifts upper bits of ROM bank 1 window", () => {
                // 64-bank cart (romSizeByte=5): mask=63, LowRegister=1 after init
                // high=1 → rom1Bank = ((1<<5)|1) & 63 = 33
                setupMBCCart(CartridgeType.MBC1, 5, 0);
                mbcWrite(0x4000, 0x01);
                assertEquals<u8>(readRomBank1Sentinel(), 33, "high=1, low=1 → bank 33");
            });

            it("rom0 stays at bank 0 in simple mode", () => {
                setupMBCCart(CartridgeType.MBC1, 5, 0);
                mbcWrite(0x4000, 0x01);
                assertEquals<u8>(readRomBank0Sentinel(), 0, "rom0 fixed at bank 0");
            });
        });

        describe("mode register (0x6000-0x7FFF)", () => {
            it("write 0x01 enables advanced mode", () => {
                // 64-bank cart: RomBankCount=64 > 32 → mode toggle not blocked
                setupMBCCart(CartridgeType.MBC1, 5, 0);
                mbcWrite(0x4000, 0x01); // high=1 (ignored in simple mode)
                assertEquals<u8>(readRomBank0Sentinel(), 0, "rom0=0 before mode switch");
                mbcWrite(0x6000, 0x01); // enable advanced mode
                // rom0Bank = (1<<5) & 63 = 32
                assertEquals<u8>(readRomBank0Sentinel(), 32, "advanced mode: rom0 remapped to bank 32");
            });
        });

        describe("RAM enable lower-nibble rule", () => {
            it("enable via 0x1A (any value with lower nibble 0xA)", () => {
                setupMBCCart(CartridgeType.MBC1_RAM, 0, 2);
                mbcWrite(0x0000, 0x1A);
                assertEquals<bool>(isRamEnabled(), true, "0x1A enables RAM");
            });

            it("enable via 0xFA", () => {
                setupMBCCart(CartridgeType.MBC1_RAM, 0, 2);
                mbcWrite(0x0000, 0xFA);
                assertEquals<bool>(isRamEnabled(), true, "0xFA enables RAM");
            });

            it("disable via 0x0B (lower nibble != 0xA)", () => {
                setupMBCCart(CartridgeType.MBC1_RAM, 0, 2);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x0000, 0x0B);
                assertEquals<bool>(isRamEnabled(), false, "0x0B disables RAM");
            });
        });

        describe("mode 0 RAM bank always 0", () => {
            it("high register set, mode 0: RAM stays at bank 0", () => {
                setupMBCCart(CartridgeType.MBC1_RAM, 0, 3); // 4 RAM banks
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x4000, 0x02); // high=2, mode 0
                writeRam(0x11);
                assertEquals<u32>(
                    MBC.MapRam(0xA000),
                    GB_EXT_RAM_START,
                    "mode 0: RAM locked to bank 0"
                );
            });
        });

        describe("banks $20/$40/$60 inaccessible in ROM bank 1 window", () => {
            it("writing $20 to $2000 selects bank 1 (lower 5 bits = 0 → remapped)", () => {
                setupMBCCart(CartridgeType.MBC1, 3, 0); // 16 banks
                mbcWrite(0x2000, 0x20);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank $20 → bank 1");
            });

            it("writing $40 to $2000 selects bank 1", () => {
                setupMBCCart(CartridgeType.MBC1, 3, 0);
                mbcWrite(0x2000, 0x40);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank $40 → bank 1");
            });

            it("write $E1 to $2000 → bank 1 (upper bits discarded by 5-bit mask)", () => {
                setupMBCCart(CartridgeType.MBC1, 3, 0);
                mbcWrite(0x2000, 0xE1);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "0xE1 & 0x1F = 1 → bank 1");
            });
        });

        describe("advanced mode", () => {
            it("bank 0 remapped by high register", () => {
                setupMBCCart(CartridgeType.MBC1, 5, 0); // 64 banks, mask=63
                mbcWrite(0x6000, 0x01); // advanced mode
                mbcWrite(0x4000, 0x01); // high=1 → rom0Bank = (1<<5) & 63 = 32
                assertEquals<u8>(readRomBank0Sentinel(), 32, "rom0 = bank 32 sentinel");
                assertEquals<u32>(
                    MBC.MapRom(0x0000),
                    CARTRIDGE_ROM_START + 32 * ROM_BANK_SIZE,
                    "MapRom(0x0000) = bank 32 start"
                );
            });

            it("RAM bank switching via high register", () => {
                // 4 RAM banks (ramSizeByte=3): RamBankCount=4 > 1 → mode toggle allowed
                setupMBCCart(CartridgeType.MBC1_RAM, 0, 3);
                mbcWrite(0x0000, 0x0A); // enable RAM
                writeRam(0x11);         // write 0x11 to bank 0

                mbcWrite(0x6000, 0x01); // advanced mode
                mbcWrite(0x4000, 0x02); // high=2 → ramBank=2

                assertEquals<u32>(
                    MBC.MapRam(0xA000),
                    GB_EXT_RAM_START + 2 * GB_EXT_RAM_BANK_SIZE,
                    "MapRam(0xA000) = RAM bank 2 start"
                );
                writeRam(0x22);         // write 0x22 to bank 2

                mbcWrite(0x4000, 0x00); // back to bank 0
                assertEquals<u8>(readRam(), 0x11, "bank 0 value preserved");
            });
        });

    });

    describe("MBC2", () => {

        describe("RAM enable/disable", () => {
            it("enable RAM: write 0x0A to addr with bit 8 clear (0x0000)", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                assertEquals<bool>(isRamEnabled(), false, "initially disabled");
                mbcWrite(0x0000, 0x0A);
                assertEquals<bool>(isRamEnabled(), true, "enabled after 0x0A");
            });

            it("disable RAM: write non-0x0A to addr with bit 8 clear", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x0000, 0x00);
                assertEquals<bool>(isRamEnabled(), false, "disabled after 0x00");
            });
        });

        describe("ROM bank switching", () => {
            it("ROM bank select: write bank 3 to addr with bit 8 set (0x2100)", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0); // 16 banks
                mbcWrite(0x2100, 3);
                assertEquals<u8>(readRomBank1Sentinel(), 3, "bank 3 selected");
            });

            it("bank 0 write to addr with bit 8 set remaps to bank 1", () => {
                setupMBCCart(CartridgeType.MBC2, 1, 0); // 4 banks
                mbcWrite(0x2100, 0);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank 0 → bank 1");
            });

            it("MapRom: bank 0 range always fixed regardless of selected bank", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                mbcWrite(0x2100, 3);
                assertEquals<u8>(readRomBank0Sentinel(), 0, "bank 0 range fixed at sentinel 0");
            });
        });

        describe("RAM mapping", () => {
            it("MapRam always maps to bank 0 base regardless of ROM bank", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                mbcWrite(0x2100, 3);
                assertEquals<u32>(MBC.MapRam(0xA000), GB_EXT_RAM_START, "MapRam(0xA000) = bank 0 base");
            });

            it("MapRam offset within bank 0 is fixed", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                mbcWrite(0x2100, 5);
                assertEquals<u32>(MBC.MapRam(0xA100), GB_EXT_RAM_START + 0x100, "MapRam(0xA100) offset correct");
            });

            it("$A200-$BFFF echoes $A000-$A1FF (9-bit address mask)", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                // $A200 & 0x01FF = 0x0000, so maps same as $A000
                assertEquals<u32>(MBC.MapRam(0xA200), MBC.MapRam(0xA000), "0xA200 echoes 0xA000");
                // $A1FF maps to byte 511 (0x1FF), $A3FF also maps to byte 511
                assertEquals<u32>(MBC.MapRam(0xA3FF), MBC.MapRam(0xA1FF), "0xA3FF echoes 0xA1FF");
            });
        });

        describe("RAM enable lower-nibble rule (bit8=0)", () => {
            it("enable via 0x1A (lower nibble 0xA, bit8=0)", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                mbcWrite(0x0000, 0x1A);
                assertEquals<bool>(isRamEnabled(), true, "0x1A enables RAM");
            });

            it("enable via 0xFA (lower nibble 0xA, bit8=0)", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                mbcWrite(0x0200, 0xFA); // addr $0200, bit8=0
                assertEquals<bool>(isRamEnabled(), true, "0xFA at bit8=0 enables RAM");
            });
        });

        describe("ROM bank lower-4-bit mask (bit8=1)", () => {
            it("write 0xF3 to addr with bit8=1 → bank 3 (upper nibble discarded)", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0); // 16 banks
                mbcWrite(0x2100, 0xF3);
                assertEquals<u8>(readRomBank1Sentinel(), 3, "0xF3 masked to lower nibble → bank 3");
            });

            it("write 0x10 to addr with bit8=1 → bank 1 (0x10 & 0x0F = 0 → 1 via 0→1 rule)", () => {
                setupMBCCart(CartridgeType.MBC2, 3, 0);
                mbcWrite(0x2100, 0x10);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "0x10 lower nibble = 0 → bank 1");
            });
        });

    });

    describe("MBC3", () => {

        describe("RAM enable/disable", () => {
            it("enable RAM: write 0x0A to 0x0000", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3);
                mbcWrite(0x0000, 0x0A);
                assertEquals<bool>(isRamEnabled(), true, "RAM enabled");
            });

            it("disable RAM: write 0x00 to 0x0000", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x0000, 0x00);
                assertEquals<bool>(isRamEnabled(), false, "RAM disabled");
            });
        });

        describe("ROM bank select (0x2000)", () => {
            it("writing 0 remaps to bank 1", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 0);
                mbcWrite(0x2000, 0);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank 0 → bank 1");
            });

            it("writing arbitrary bank N selects bank N", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 0);
                mbcWrite(0x2000, 5);
                assertEquals<u8>(readRomBank1Sentinel(), 5, "bank 5 selected");
            });
        });

        describe("RAM bank select (0x4000)", () => {
            it("banks 0-3 hold independent data", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3); // 4 RAM banks
                mbcWrite(0x0000, 0x0A); // enable RAM
                for (let b: u8 = 0; b < 4; b++) {
                    mbcWrite(0x4000, b);
                    writeRam(<u8>(0xA0 + b));
                }
                for (let b: u8 = 0; b < 4; b++) {
                    mbcWrite(0x4000, b);
                    assertEquals<u8>(readRam(), <u8>(0xA0 + b), "RAM bank " + b.toString());
                }
            });
        });

        describe("ROM bank select: banks $20/$40/$60 accessible (unlike MBC1)", () => {
            it("bank $20 directly selectable", () => {
                setupMBCCart(CartridgeType.MBC3, 5, 0); // 64 banks
                mbcWrite(0x2000, 0x20);
                assertEquals<u8>(readRomBank1Sentinel(), 0x20, "bank $20 accessible in MBC3");
            });

            it("bank $40 directly selectable", () => {
                setupMBCCart(CartridgeType.MBC3, 7, 0); // 128 banks
                mbcWrite(0x2000, 0x40);
                assertEquals<u8>(readRomBank1Sentinel(), 0x40, "bank $40 accessible in MBC3");
            });

            it("bank $60 directly selectable", () => {
                setupMBCCart(CartridgeType.MBC3, 7, 0);
                mbcWrite(0x2000, 0x60);
                assertEquals<u8>(readRomBank1Sentinel(), 0x60, "bank $60 accessible in MBC3");
            });

            it("bank $7F (max 7-bit) directly selectable", () => {
                setupMBCCart(CartridgeType.MBC3, 7, 0);
                mbcWrite(0x2000, 0x7F);
                assertEquals<u8>(readRomBank1Sentinel(), 0x7F, "bank $7F accessible in MBC3");
            });

            it("7-bit mask: upper bit of value ignored (bit7=1 → same as bit7=0)", () => {
                setupMBCCart(CartridgeType.MBC3, 7, 0);
                mbcWrite(0x2000, 0x85); // 0x85 & 0x7F = 5
                assertEquals<u8>(readRomBank1Sentinel(), 5, "0x85 masked to bank 5");
            });
        });

        describe("RAM enable lower-nibble rule", () => {
            it("enable via 0x0A", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3);
                mbcWrite(0x0000, 0x0A);
                assertEquals<bool>(isRamEnabled(), true, "0x0A enables RAM");
            });

            it("disable via non-0xA nibble value (0x01)", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x0000, 0x01);
                assertEquals<bool>(isRamEnabled(), false, "0x01 disables RAM");
            });
        });

        describe("RAM banks 0-7 accessible (MBC3/MBC30)", () => {
            it("bank 4 selectable", () => {
                setupMBCCart(CartridgeType.MBC3_RAM_2, 0, 3);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x4000, 4);
                assertEquals<u32>(
                    MBC.MapRam(0xA000),
                    GB_EXT_RAM_START + 4 * GB_EXT_RAM_BANK_SIZE,
                    "RAM bank 4 mapped"
                );
            });
        });

        describe("ROM bank switch does not affect RAM enable", () => {
            it("writing ROM bank $05 to $2000 keeps RAM enabled", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3);
                mbcWrite(0x0000, 0x0A); // enable RAM
                mbcWrite(0x2000, 0x05); // switch ROM bank
                assertEquals<bool>(isRamEnabled(), true, "RAM still enabled after ROM bank switch");
            });
        });

        describe("RTC stub (0x4000-0x5FFF)", () => {
            it("writing 0x08-0x0C does not crash", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 0);
                for (let v: u8 = 0x08; v <= 0x0C; v++) {
                    mbcWrite(0x4000, v);
                }
            });

            it("RAM bank switch to $08-$0C does not corrupt RAM bank state", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x4000, 0x02); // select RAM bank 2
                mbcWrite(0x4000, 0x08); // RTC select
                mbcWrite(0x4000, 0x02); // back to RAM bank 2
                assertEquals<u32>(
                    MBC.MapRam(0xA000),
                    GB_EXT_RAM_START + 2 * GB_EXT_RAM_BANK_SIZE,
                    "RAM bank 2 restored after RTC select"
                );
            });
        });

        describe("latch clock ($6000-$7FFF)", () => {
            it("write $00 then $01 to $6000 does not crash", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 0);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01);
            });
        });

    });

    describe("MBC5", () => {

        describe("RAM enable/disable", () => {
            it("enable RAM: write 0x0A to 0x0000", () => {
                setupMBCCart(CartridgeType.MBC5_RAM, 3, 2);
                assertEquals<bool>(isRamEnabled(), false, "initially disabled");
                mbcWrite(0x0000, 0x0A);
                assertEquals<bool>(isRamEnabled(), true, "enabled after 0x0A");
            });

            it("disable RAM: write 0x00 to 0x0000", () => {
                setupMBCCart(CartridgeType.MBC5_RAM, 3, 2);
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x0000, 0x00);
                assertEquals<bool>(isRamEnabled(), false, "disabled after 0x00");
            });

            it("enable RAM via 0x1FFF", () => {
                setupMBCCart(CartridgeType.MBC5_RAM, 3, 2);
                mbcWrite(0x1FFF, 0x0A);
                assertEquals<bool>(isRamEnabled(), true, "enabled via 0x1FFF");
            });
        });

        describe("ROM bank switching low 8 bits (0x2000-0x2FFF)", () => {
            it("write bank 1 selects bank 1", () => {
                setupMBCCart(CartridgeType.MBC5, 3, 0);
                mbcWrite(0x2000, 1);
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank 1 selected");
            });

            it("write bank 5 selects bank 5", () => {
                setupMBCCart(CartridgeType.MBC5, 3, 0);
                mbcWrite(0x2000, 5);
                assertEquals<u8>(readRomBank1Sentinel(), 5, "bank 5 selected");
            });

            it("bank 0 is selectable (no 0->1 remapping)", () => {
                setupMBCCart(CartridgeType.MBC5, 3, 0);
                mbcWrite(0x2000, 0);
                assertEquals<u8>(readRomBank1Sentinel(), 0, "bank 0 selectable in MBC5");
            });

            it("ROM bank 0 window always fixed at physical bank 0", () => {
                setupMBCCart(CartridgeType.MBC5, 3, 0);
                mbcWrite(0x2000, 5);
                assertEquals<u8>(readRomBank0Sentinel(), 0, "bank 0 window always physical bank 0");
            });
        });

        describe("ROM bank bit 8 (0x3000-0x3FFF)", () => {
            it("bit 8 set maps 0x4000 to bank 256", () => {
                setupMBCCart(CartridgeType.MBC5, 8, 0); // 512 banks
                mbcWrite(0x2000, 0x00);
                mbcWrite(0x3000, 0x01); // bit 8 = 1 → bank 256
                assertEquals<u32>(MBC.MapRom(0x4000), CARTRIDGE_ROM_START + 256 * ROM_BANK_SIZE, "MapRom = bank 256");
            });

            it("bit 8 + low bits combine for 9-bit bank number", () => {
                setupMBCCart(CartridgeType.MBC5, 8, 0);
                mbcWrite(0x2000, 5);
                mbcWrite(0x3000, 1); // bank 261
                assertEquals<u32>(MBC.MapRom(0x4000), CARTRIDGE_ROM_START + 261 * ROM_BANK_SIZE, "MapRom = bank 261");
            });

            it("only bit 0 of 0x3000 write used for bit 8", () => {
                setupMBCCart(CartridgeType.MBC5, 8, 0);
                mbcWrite(0x2000, 0x01);
                mbcWrite(0x3000, 0xFE); // bit 0 = 0 → bit 8 cleared → bank 1
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bit 0 of 0x3000 = 0 → bit 8 clear");
            });

            it("clearing bit 8 goes back to low-bank", () => {
                setupMBCCart(CartridgeType.MBC5, 8, 0);
                mbcWrite(0x2000, 0x05);
                mbcWrite(0x3000, 0x01); // bank 261
                mbcWrite(0x3000, 0x00); // clear bit 8 → bank 5
                assertEquals<u8>(readRomBank1Sentinel(), 5, "bit 8 cleared → bank 5");
            });

            it("can select bank 511 (max 9-bit bank)", () => {
                setupMBCCart(CartridgeType.MBC5, 8, 0); // 512 banks
                mbcWrite(0x2000, 0xFF); // low 8 = 255
                mbcWrite(0x3000, 0x01); // bit 8 = 1 → bank 511
                assertEquals<u8>(readRomBank1Sentinel(), 0xFF, "bank 511 sentinel = 255");
            });
        });

        describe("RAM bank switching (0x4000-0x5FFF)", () => {
            it("banks 0-3 hold independent data", () => {
                setupMBCCart(CartridgeType.MBC5_RAM, 3, 3); // 4 RAM banks
                mbcWrite(0x0000, 0x0A);
                for (let b: u8 = 0; b < 4; b++) {
                    mbcWrite(0x4000, b);
                    writeRam(<u8>(0xB0 + b));
                }
                for (let b: u8 = 0; b < 4; b++) {
                    mbcWrite(0x4000, b);
                    assertEquals<u8>(readRam(), <u8>(0xB0 + b), "RAM bank " + b.toString());
                }
            });

            it("write to 0x4000 selects RAM bank via lower 4 bits", () => {
                setupMBCCart(CartridgeType.MBC5_RAM, 3, 3);
                mbcWrite(0x4000, 0xF2); // lower 4 bits = 2
                assertEquals<u32>(MBC.MapRam(0xA000), GB_EXT_RAM_START + 2 * GB_EXT_RAM_BANK_SIZE, "bank 2 via masked write");
            });
        });

        describe("MapRom", () => {
            it("0x0000 always maps to physical bank 0", () => {
                setupMBCCart(CartridgeType.MBC5, 3, 0);
                mbcWrite(0x2000, 7);
                assertEquals<u32>(MBC.MapRom(0x0000), CARTRIDGE_ROM_START, "bank 0 window = ROM start");
            });

            it("0x4000 maps to selected ROM bank", () => {
                setupMBCCart(CartridgeType.MBC5, 3, 0);
                mbcWrite(0x2000, 7);
                assertEquals<u32>(MBC.MapRom(0x4000), CARTRIDGE_ROM_START + 7 * ROM_BANK_SIZE, "MapRom(0x4000) = bank 7");
            });
        });

    });

    describe("SaveGame", () => {
        it("WrapToCartridgeSize sizes buffer to ramBankCount × GB_EXT_RAM_BANK_SIZE", () => {
            setupMBCCart(CartridgeType.MBC1_RAM, 0, 3); // ramSizeByte=3 → 4 banks
            SaveGame.Init();
            assertEquals<i32>(SaveGame.GetBuffer().byteLength, 4 * GB_EXT_RAM_BANK_SIZE, "buffer length");
        });

        it("Save() copies external RAM to buffer", () => {
            setupMBCCart(CartridgeType.MBC1_RAM, 0, 3);
            SaveGame.Init();
            store<u8>(GB_EXT_RAM_START, 0xAB);
            SaveGame.Save();
            assertEquals<u8>(SaveGame.GetBuffer()[0], 0xAB, "buffer[0] matches sentinel");
        });

        it("LoadSave() copies buffer into external RAM", () => {
            setupMBCCart(CartridgeType.MBC1_RAM, 0, 3);
            mbcWrite(0x0000, 0x0A); // enable RAM
            SaveGame.Init();
            const save = new Uint8Array(4 * GB_EXT_RAM_BANK_SIZE);
            save[0] = 0xCD;
            SaveGame.LoadSave(save);
            assertEquals<u8>(readRam(), 0xCD, "ext RAM[0] matches sentinel");
        });

        it("LoadSave() with oversized buffer logs warning, no crash", () => {
            setupMBCCart(CartridgeType.MBC1_RAM, 0, 3);
            SaveGame.Init();
            const oversized = new Uint8Array(4 * GB_EXT_RAM_BANK_SIZE + 1);
            SaveGame.LoadSave(oversized);
        });

        it("LoadSave() with undersized buffer logs warning, no crash", () => {
            setupMBCCart(CartridgeType.MBC1_RAM, 0, 3);
            SaveGame.Init();
            const undersized = new Uint8Array(GB_EXT_RAM_BANK_SIZE);
            SaveGame.LoadSave(undersized);
        });
    });

    return true;
}
