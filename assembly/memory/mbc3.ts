import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { enableRam, log, MBC_Handler } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
class MBC3 {
    private static romBank: u32 = 1;
    private static ramBank: u8 = 0;
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
                if (value == 0x0A)
                    enableRam(true);
                else if (value == 0)
                    enableRam(false);
                else if (Logger.verbose >= 1) {
                    log(`Unhandled value written at ${uToHex<u16>(gbAddress)}: ` + value.toString())
                }
                return;
            case 0x2:
            case 0x3:
                const newRomBank = value == 0 ? 1 : value;
                if (newRomBank != MBC3.romBank) {
                    if (Logger.verbose >= 1)
                        log(`Switching ROM bank(1) from #${MBC3.romBank} to ${newRomBank}`)
                }
                MBC3.romBank = newRomBank;
                break;
            case 0x4:
            case 0x5:
                if (value <= 3) {
                    const newRamBank = value & 0x3;
                    if (newRamBank != MBC3.ramBank && Logger.verbose >= 1)
                        log(`Switching RAM bank from #${MBC3.ramBank} to ${newRamBank}`)
                    MBC3.ramBank = newRamBank;
                }
                else if (value >= 0x8 && value <= 0xC) {
                    if (Logger.verbose >= 1) {
                        log('RTC not supported. Ignoring this write to ' + uToHex<u16>(gbAddress));
                    }
                } else if (Logger.verbose >= 1) {
                    log('Ignoring unhandled value write to ' + uToHex<u16>(gbAddress))
                }
                break;
            case 0x6:
            case 0x7:
                if (Logger.verbose >= 1) {
                    log('RTC not supported. Ignoring this write to ' + uToHex<u16>(gbAddress));
                }
                break;
            case 0xA:
            case 0xB:
                if (Logger.verbose >= 1) {
                    log('RTC not supported. Ignoring this write to ' + uToHex<u16>(gbAddress));
                }
                break;
        }

        if ((gbAddress & 0x1000) == 0) { // Ram enabled register bit
            enableRam((value & 0xF) == 0xA);
        } else {
            MBC3.romBank = value & 0xF;
        }
    }

    static MapRom(gbAddress: u16): u32 {
        return gbAddress < 0x4000 ?
            CARTRIDGE_ROM_START + gbAddress
            : CARTRIDGE_ROM_START + gbAddress - 0x4000 + ROM_BANK_SIZE * MBC3.romBank;
    }

    static MapRam(gbAddress: u16): u32 {
        if (!MBC3.ramEnabled && Logger.verbose >= 1) {
            log('Warning, accessing RAM while disabled, at ' + uToHex<u16>(gbAddress));
        }
        return GB_EXT_RAM_START + gbAddress - 0xA000 + MBC3.ramBank * GB_EXT_RAM_BANK_SIZE;
    }
}

export const MBC3_Handler: MBC_Handler = {
    Init: MBC3.Init,
    WriteToRom: MBC3.HandleWrite,
    MapRom: MBC3.MapRom,
    MapRam: MBC3.MapRam
}
