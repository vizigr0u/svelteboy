import { CartridgeType } from "../metadata";
import { isRamEnabled } from "../memory/mbcTypes";
import { MBC } from "../memory/mbc";
import { CARTRIDGE_ROM_START, ROM_BANK_SIZE, GB_EXT_RAM_START, GB_EXT_RAM_BANK_SIZE } from "../memory/memoryConstants";
import { SaveGame } from "../memory/savegame";
import { describe, it, assertEquals } from "./framework";
import { setupMBCCart, readRomBank0Sentinel, readRomBank1Sentinel, writeRam, readRam, mbcWrite } from "./mbcTestHelpers";

export function testMbc(): boolean {
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
                mbcWrite(0x2000, 3); // 3 % 2 = 1 → 1 & 1 = 1
                assertEquals<u8>(readRomBank1Sentinel(), 1, "bank 3 masked to bank 1");
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

        describe("RTC stub (0x4000-0x5FFF)", () => {
            it("writing 0x08-0x0C does not crash", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 0);
                for (let v: u8 = 0x08; v <= 0x0C; v++) {
                    mbcWrite(0x4000, v);
                }
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
