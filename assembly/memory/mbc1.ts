import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { enableRam, log, MBC_Handler } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
class MBC1 {
    private static LowRegister: u8 = 1;
    private static HighRegister: u8 = 0;
    private static advancedMode: boolean = false;

    // private static rom0Base: u32 = 0;
    // private static rom1Base: u32 = 0;
    // private static ramBase: u32 = 0;

    private static romBankMask: u8 = 0xFF;
    private static rom0Bank: u8 = 0;
    private static rom1Bank: u8 = 1;
    private static ramBank: u8 = 0;

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC1');
        MBC1.advancedMode = false;
        MBC1.LowRegister = 1;
        MBC1.HighRegister = 0;
        // MBC1.rom0Base = CARTRIDGE_ROM_START;
        // MBC1.rom1Base = CARTRIDGE_ROM_START + ROM_BANK_SIZE;
        // MBC1.ramBase = GB_EXT_RAM_START + (MBC1.advancedMode ? (MBC1.HighRegister << 13) : 0);

        MBC1.rom0Bank = 0;
        MBC1.rom1Bank = 1;
        MBC1.ramBank = 0;
        assert(Cartridge.Data.RomBankCount <= 128, 'Unexpectedly large number for ROM banks for MBC1 ROM');
        MBC1.romBankMask = <u8>(Cartridge.Data.RomBankCount - 1)
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
                const translated: u16 = (value & 0x1F) == 0 ? 1 : (value & 0x1F);
                // MBC1 bug that makes it possible to map to Rom Bank #0 (if Cartridge.Data.RomBankCount - 1 < 0x1F)
                assert(Cartridge.Data.RomBankCount <= 32, 'Unexpectedly high rom bank count in MBC1: ' + Cartridge.Data.RomBankCount.toString());
                MBC1.LowRegister = <u8>(translated % Cartridge.Data.RomBankCount);
                break;
            case 0x4:
            case 0x5:
                MBC1.HighRegister = (value & 0b11);
                break;
            case 0x6:
            case 0x7:
                MBC1.advancedMode = (value & 1) == 1;
                if (Cartridge.Data.RamBankCount <= 1 && Cartridge.Data.RomBankCount <= 32) {
                    if (Logger.verbose >= 1) {
                        log('Ignoring MBC write to range 0x6000-0x7FFF on smaller cartridge.')
                    }
                    MBC1.advancedMode = false;
                }
                break;
        }

        // const bank1Number: u32 = <u32>MBC1.HighRegister << 19;
        // const rom0hi: u32 = MBC1.advancedMode ? rom1hi : 0;
        // const rom1bank: u32 = <u32>MBC1.LowRegister << 14;
        // MBC1.rom0Base = CARTRIDGE_ROM_START + rom0hi;
        // MBC1.rom1Base = CARTRIDGE_ROM_START + (rom1hi | rom1bank);
        // MBC1.ramBase = GB_EXT_RAM_START + (MBC1.advancedMode ? (MBC1.HighRegister << 13) : 0);
        const oldRom0 = MBC1.rom0Bank;
        const oldRom1 = MBC1.rom1Bank;
        const oldRam = MBC1.ramBank;
        MBC1.rom0Bank = MBC1.advancedMode ? (MBC1.HighRegister << 5) & MBC1.romBankMask : 0;
        MBC1.rom1Bank = ((MBC1.HighRegister << 5) | MBC1.LowRegister) & MBC1.romBankMask;
        MBC1.ramBank = MBC1.advancedMode ? MBC1.HighRegister : 0;
        if (oldRam != MBC1.ramBank && Logger.verbose >= 1) { // TODO: Tone down all 3
            log(`Switching Ram bank from ${oldRam} to ${MBC1.ramBank} ([${uToHex<u16>(gbAddress)}] <- ${value})`)
        }
        if (oldRom1 != MBC1.rom1Bank && Logger.verbose >= 1) {
            log(`Switching Rom bank 1 from ${oldRom1} to ${MBC1.rom1Bank} ([${uToHex<u16>(gbAddress)}] <- ${value})`)
        }
        if (oldRom0 != MBC1.rom0Bank && Logger.verbose >= 1) {
            log(`Switching Rom bank 0 from ${oldRom0} to ${MBC1.rom0Bank} ([${uToHex<u16>(gbAddress)}] <- ${value})`)
        }
    }

    static MapRom(gbAddress: u16): u32 {
        if (gbAddress < 0x4000)
            return CARTRIDGE_ROM_START + gbAddress + MBC1.rom0Bank * ROM_BANK_SIZE;
        return CARTRIDGE_ROM_START + gbAddress - 0x4000 + MBC1.rom1Bank * ROM_BANK_SIZE;

        // const result: u32 = gbAddress < 0x4000 ? MBC1.rom0Base + gbAddress : MBC1.rom1Base + gbAddress - 0x4000;
        // if (Logger.verbose >= 3) {
        //     log(`MBC1 Mapping ${uToHex<u16>(gbAddress)} to ${uToHex<u32>(result)} (bankId: ${bankId})`)
        // }
        // return result;
    }

    static MapRam(gbAddress: u16): u32 {
        return GB_EXT_RAM_START + gbAddress - 0xA000 + MBC1.ramBank * GB_EXT_RAM_BANK_SIZE;
    }
}

export const MBC1_Handler: MBC_Handler = {
    Init: MBC1.Init,
    WriteToRom: MBC1.HandleWrite,
    MapRom: MBC1.MapRom,
    MapRam: MBC1.MapRam
}
