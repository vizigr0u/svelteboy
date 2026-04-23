import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { SaveGame } from "./savegame";

let ramEnabled: boolean = false;
let ramAltered: boolean = false;

export function log(s: string): void {
    Logger.Log("MBC: " + s);
}

export function isRamEnabled(): boolean {
    return ramEnabled;
}

export function getRamEnabled(): boolean {
    return ramEnabled;
}

export function setRamEnabledRaw(enabled: boolean): void {
    ramEnabled = enabled;
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