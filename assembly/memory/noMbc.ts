import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { MBC_Handler, enableRam, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START } from "./memoryConstants";

function Init(): void {
    if (Logger.verbose >= 1)
        log('No MBC to initialize.');
    enableRam(true);
}

function WriteToRom(gbAddress: u16, value: u8): void {
    if (Logger.verbose >= 2) {
        log('Ignoring writing to ROM with cartridge with no MBC: ' + `${uToHex<u8>(value)} to ${uToHex<u16>(gbAddress)}`)
    }
}

function MapRom(gbAddress: u16): u32 {
    return <u32>gbAddress + CARTRIDGE_ROM_START;
}

function MapRam(gbAddress: u16): u32 {
    return <u32>gbAddress + GB_EXT_RAM_START - 0xA000;
}

export const NoMBCHandler: MBC_Handler = {
    Init,
    MapRam,
    MapRom,
    WriteToRom
}
