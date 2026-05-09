import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { MBC } from "./mbc";
import { enableRam, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

@final
export class NoMBC {
    static Init(): void {
        if (Logger.verbose >= 1)
            log('No MBC to initialize.');
        enableRam(true);
        MBC.extRamMask = 0x1FFF;
        NoMBC.Recache();
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        if (Logger.verbose >= 2) {
            log('Ignoring writing to ROM with cartridge with no MBC: ' + `${uToHex<u8>(value)} to ${uToHex<u16>(gbAddress)}`)
        }
        NoMBC.Recache();
    }

    @inline
    static Recache(): void {
        MBC.rom0Base = CARTRIDGE_ROM_START;
        MBC.rom1Base = CARTRIDGE_ROM_START + ROM_BANK_SIZE;
        MBC.extRamBase = GB_EXT_RAM_START;
    }
}
