import { CartridgeType } from "../metadata";
import { isRamEnabled } from "../memory/mbcTypes";
import { MBC } from "../memory/mbc";
import { CARTRIDGE_ROM_START, ROM_BANK_SIZE, GB_EXT_RAM_START, GB_EXT_RAM_BANK_SIZE } from "../memory/memoryConstants";
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
    return true;
}
