import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { enableRam, isRamEnabled, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
export class MBC2 {
    static romBank: u32 = 1;

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC2');
        MBC2.romBank = 1;
        enableRam(false);
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
    }

    static MapRom(gbAddress: u16): u32 {
        return gbAddress < 0x4000 ?
            CARTRIDGE_ROM_START + gbAddress
            : CARTRIDGE_ROM_START + gbAddress - 0x4000 + ROM_BANK_SIZE * MBC2.romBank;
    }

    static MapRam(gbAddress: u16): u32 {
        return GB_EXT_RAM_START + ((gbAddress - 0xA000) & 0x01FF);
    }
}

