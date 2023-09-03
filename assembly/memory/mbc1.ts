import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { MBC, log } from "./mbc";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START } from "./memoryConstants";

@final
export class MBC1 {
    private static LowRegister: u8 = 1;
    private static HighRegister: u8 = 0;
    private static advancedMode: boolean = false;

    static Init(): void {
        MBC1.LowRegister = 1;
        MBC1.HighRegister = 0;
        MBC1.advancedMode = false;
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        const hiByte: u8 = <u8>(gbAddress >> 12);
        switch (hiByte) {
            case 0x0:
            case 0x1:
                MBC.enableRam((value & 0xF) == 0xA);
                return;
            case 0x2:
            case 0x3:
                const translated: u8 = (value & 0x1F) == 0 ? 1 : (value & 0x1F);
                // MBC1 bug that makes it possible to map to Rom Bank #0 (if Cartridge.Data.RomBankCount - 1 < 0x1F)
                assert(Cartridge.Data.RomBankCount <= 32, 'Unexpectedly high rom bank count in MBC1: ' + Cartridge.Data.RomBankCount.toString());
                MBC1.LowRegister = translated % <u8>Cartridge.Data.RomBankCount;
                return;
            case 0x4:
            case 0x5:
                MBC1.HighRegister = value & 0b11;
                return;
            case 0x6:
            case 0x7:
                if (Cartridge.Data.RamBankCount <= 1 && Cartridge.Data.RamBankCount <= 32) {
                    if (Logger.verbose >= 1) {
                        log('Ignoring MBC write to range 0x6000-0x7FFF on smaller cartridge.')
                    }
                    return;
                }
                MBC1.advancedMode = (value & 1) == 1;
                return;
        }
    }

    static MapRom(gbAddress: u16): u32 {
        const hi: u32 = (gbAddress >= 0x4000 || MBC1.advancedMode) ? <u32>MBC1.HighRegister << 19 : 0;
        const bank: u32 = (gbAddress >= 0x4000) ? <u32>MBC1.LowRegister << 14 : 0;
        return CARTRIDGE_ROM_START + (hi | bank | <u32>gbAddress);
    }

    static MapRam(gbAddress: u16): u32 {
        const hi: u32 = MBC1.advancedMode ? (MBC1.HighRegister << 13) : 0;
        return GB_EXT_RAM_START - 0xA000 + (hi | <u32>gbAddress);
    }
}
