import { Logger } from "../debug/logger";

export type MBC_Write = (gbAddress: u16, value: u8) => void;
export type MBC_Mapper = (gbAdress: u16) => u32;

let ramEnabled: boolean = false;

export class MBC_Handler {
    Init: () => void;
    WriteToRom: MBC_Write;
    MapRom: MBC_Mapper;
    MapRam: MBC_Mapper;
    // RamEnabled: () => boolean;
}


export function log(s: string): void {
    Logger.Log("MBC: " + s);
}

export function enableRam(enabled: boolean = true): void {
    if (Logger.verbose >= 1)
        log(enabled ? 'Enabling RAM' : 'disabling RAM');
    ramEnabled = enabled;
}
