import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { enableRam, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
export class MBC3 {
    static romBank: u32 = 1;
    static ramBank: u8 = 0;
    private static ramEnabled: boolean = false;

    static get RamEnabled(): boolean { return MBC3.ramEnabled; }

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC3');
        MBC3.romBank = 1;
        MBC3.ramBank = 0;
        enableRam(false);
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        const hiByte: u8 = <u8>(gbAddress >> 12);
        switch (hiByte) {
            case 0x0:
            case 0x1:
                enableRam((value & 0xF) == 0xA);
                return;
            case 0x2:
            case 0x3:
                const newRomBank: u32 = value == 0 ? 1 : (value & 0x7F);
                if (newRomBank != MBC3.romBank && Logger.verbose >= 2)
                    log(`Switching ROM bank(1) from #${MBC3.romBank} to ${newRomBank}`)
                MBC3.romBank = newRomBank;
                return;
            case 0x4:
            case 0x5:
                if (value <= 7) {
                    const newRamBank = value & 0x7;
                    if (newRamBank != MBC3.ramBank && Logger.verbose >= 2)
                        log(`Switching RAM bank from #${MBC3.ramBank} to ${newRamBank}`)
                    MBC3.ramBank = newRamBank;
                } else if (value >= 0x8 && value <= 0xC) {
                    if (Logger.verbose >= 2)
                        log('RTC not supported. Ignoring this write to ' + uToHex<u16>(gbAddress));
                } else if (Logger.verbose >= 2) {
                    log('Ignoring unhandled value write to ' + uToHex<u16>(gbAddress))
                }
                return;
            case 0x6:
            case 0x7:
                if (Logger.verbose >= 2)
                    log('RTC not supported. Ignoring this write to ' + uToHex<u16>(gbAddress));
                return;
            case 0xA:
            case 0xB:
                if (Logger.verbose >= 2)
                    log('RTC not supported. Ignoring this write to ' + uToHex<u16>(gbAddress));
                return;
        }
    }

    static MapRom(gbAddress: u16): u32 {
        return gbAddress < 0x4000 ?
            CARTRIDGE_ROM_START + gbAddress
            : CARTRIDGE_ROM_START + gbAddress - 0x4000 + ROM_BANK_SIZE * MBC3.romBank;
    }

    static MapRam(gbAddress: u16): u32 {
        return GB_EXT_RAM_START + gbAddress - 0xA000 + MBC3.ramBank * GB_EXT_RAM_BANK_SIZE;
    }
}

