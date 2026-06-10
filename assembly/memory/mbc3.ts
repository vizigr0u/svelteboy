import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { MBC } from "./mbc";
import { MBC3RTC } from "./mbc3rtc";
import { enableRam, isRamEnabled, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
export class MBC3 {
    static romBank: u32 = 1;
    static romBankMask: u8 = 0x7F;
    static ramBank: u8 = 0;
    static rtcSelect: i32 = -1;
    static latchPrev: u8 = 0xFF;
    private static ramEnabled: boolean = false;

    static get RamEnabled(): boolean { return MBC3.ramEnabled; }

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC3');
        MBC3.romBank = 1;
        MBC3.ramBank = 0;
        MBC3.rtcSelect = -1;
        MBC3.latchPrev = 0xFF;
        MBC3.romBankMask = <u8>((Cartridge.Data.RomBankCount - 1) & 0x7F);
        enableRam(false);
        MBC.extRamMask = 0x1FFF;
        MBC3RTC.Init();
        MBC3.Recache();
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        const hiByte: u8 = <u8>(gbAddress >> 12);
        switch (hiByte) {
            case 0x0:
            case 0x1:
                enableRam((value & 0xF) == 0xA);
                MBC3.Recache();
                return;
            case 0x2:
            case 0x3:
                const newRomBank: u32 = (value == 0 ? 1 : (value & 0x7F)) & MBC3.romBankMask;
                if (newRomBank != MBC3.romBank && Logger.verbose >= 2)
                    log(`Switching ROM bank(1) from #${MBC3.romBank} to ${newRomBank}`)
                MBC3.romBank = newRomBank;
                MBC3.Recache();
                return;
            case 0x4:
            case 0x5:
                if (value <= 7) {
                    MBC3.rtcSelect = -1;
                    const newRamBank = value & 0x7;
                    if (newRamBank != MBC3.ramBank && Logger.verbose >= 2)
                        log(`Switching RAM bank from #${MBC3.ramBank} to ${newRamBank}`)
                    MBC3.ramBank = newRamBank;
                    MBC3.Recache();
                } else if (value >= 0x8 && value <= 0xC) {
                    if (Cartridge.Data.HasRTC) {
                        MBC3.rtcSelect = <i32>(value - 0x08);
                    } else if (Logger.verbose >= 2) {
                        log('Ignoring RTC select on non-RTC cartridge at ' + uToHex<u16>(gbAddress));
                    }
                } else if (Logger.verbose >= 2) {
                    log('Ignoring unhandled value write to ' + uToHex<u16>(gbAddress))
                }
                return;
            case 0x6:
            case 0x7:
                if (Cartridge.Data.HasRTC) {
                    if (MBC3.latchPrev == 0 && value == 1) {
                        MBC3RTC.Latch();
                    }
                    MBC3.latchPrev = value;
                } else if (Logger.verbose >= 2) {
                    log('Ignoring latch write on non-RTC cartridge at ' + uToHex<u16>(gbAddress));
                }
                return;
        }
    }

    static HandleRamRead(gbAddress: u16): i32 {
        if (MBC3.rtcSelect < 0) return -1;
        if (!isRamEnabled()) return 0xFF;
        return <i32>MBC3RTC.ReadLatched(MBC3.rtcSelect);
    }

    static HandleRamWrite(gbAddress: u16, value: u8): bool {
        if (MBC3.rtcSelect < 0) return false;
        if (isRamEnabled()) {
            MBC3RTC.WriteReg(MBC3.rtcSelect, value);
        }
        return true;
    }

    @inline
    static Recache(): void {
        MBC.rom0Base = CARTRIDGE_ROM_START;
        MBC.rom1Base = CARTRIDGE_ROM_START + MBC3.romBank * ROM_BANK_SIZE;
        MBC.extRamBase = GB_EXT_RAM_START + <u32>MBC3.ramBank * GB_EXT_RAM_BANK_SIZE;
    }
}
