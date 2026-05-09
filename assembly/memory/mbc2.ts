import { Logger } from "../debug/logger";
import { MBC } from "./mbc";
import { enableRam, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
export class MBC2 {
    static romBank: u32 = 1;

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC2');
        MBC2.romBank = 1;
        enableRam(false);
        MBC.extRamMask = 0x01FF; // 512×4-bit RAM mirrors every 512 bytes within $A000-$BFFF
        MBC2.Recache();
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        if ((gbAddress & 0x0100) == 0) { // bit 8 of address: 0=RAM enable, 1=ROM bank select (Pan Docs)
            enableRam((value & 0xF) == 0xA);
        } else {
            const nibble = value & 0x0F;
            const newRomBank = nibble == 0 ? 1 : nibble;
            if (newRomBank != MBC2.romBank && Logger.verbose >= 2)
                log(`Switching ROM bank(1) from #${MBC2.romBank} to ${newRomBank}`)
            MBC2.romBank = newRomBank;
        }
        MBC2.Recache();
    }

    @inline
    static Recache(): void {
        MBC.rom0Base = CARTRIDGE_ROM_START;
        MBC.rom1Base = CARTRIDGE_ROM_START + MBC2.romBank * ROM_BANK_SIZE;
        MBC.extRamBase = GB_EXT_RAM_START;
    }
}
