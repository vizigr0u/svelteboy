import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { SaveGame } from "./savegame";

export type MBC_Write = (gbAddress: u16, value: u8) => void;
export type MBC_Mapper = (gbAdress: u16) => u32;

let ramEnabled: boolean = false;
let ramAltered: boolean = false;

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

export function isRamEnabled(): boolean {
    return ramEnabled;
}

export function enableRam(enabled: boolean = true): void {
    if (Logger.verbose >= 2)
        log(enabled ? 'Enabling RAM' : 'disabling RAM');
    if (!enabled && ramEnabled && Cartridge.Data.HasBattery && ramAltered) {
        SaveGame.Save();
        ramAltered = false;
    }
    ramEnabled = enabled;
}

export function setRamAltered(): void {
    ramAltered = true;
}