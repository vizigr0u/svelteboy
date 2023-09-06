import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { enableRam, log, MBC_Handler } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
class MBC2 {
    private static romBank: u32 = 1;
    private static ramEnabled: boolean = false;

    static get RamEnabled(): boolean { return MBC2.ramEnabled; }

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC2');
        MBC2.romBank = 1;
        enableRam(false);
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        if ((gbAddress & 0x1000) == 0) { // Ram enabled register bit
            enableRam(value == 0xA);
        } else {
            const newRomBank = value == 0 ? 1 : value;
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
        if (!MBC2.ramEnabled && Logger.verbose >= 2) {
            log('Warning, accessing RAM while disabled, at ' + uToHex<u16>(gbAddress));
        }
        return GB_EXT_RAM_START + gbAddress - 0xA000;
    }
}

export const MBC2_Handler: MBC_Handler = {
    Init: MBC2.Init,
    WriteToRom: MBC2.HandleWrite,
    MapRom: MBC2.MapRom,
    MapRam: MBC2.MapRam
}
