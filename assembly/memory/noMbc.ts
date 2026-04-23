import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { enableRam, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START } from "./memoryConstants";

@final
export class NoMBC {
    static Init(): void {
        if (Logger.verbose >= 1)
            log('No MBC to initialize.');
        enableRam(true);
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        if (Logger.verbose >= 2) {
            log('Ignoring writing to ROM with cartridge with no MBC: ' + `${uToHex<u8>(value)} to ${uToHex<u16>(gbAddress)}`)
        }
    }

    static MapRom(gbAddress: u32): u32 {
        return gbAddress + CARTRIDGE_ROM_START;
    }

    static MapRam(gbAddress: u32): u32 {
        return gbAddress + GB_EXT_RAM_START - 0xA000;
    }
}
