import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { Ppu } from "../io/video/ppu";
import { GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_SIZE, GB_EXT_RAM_START } from "./memoryConstants";

function log(s: string): void {
    Logger.Log('SAV: ' + s);
}

@final export class SaveGame {
    private static buffer: Uint8Array = new Uint8Array(GB_EXT_RAM_SIZE);
    private static adjustedBuffer: Uint8Array = Uint8Array.wrap(SaveGame.buffer.buffer, 0, SaveGame.buffer.byteLength);
    private static lastSaveFrame: u32 = 0;

    static GetBuffer(): Uint8Array { return SaveGame.adjustedBuffer; }
    static GetLastSaveFrame(): u32 { return SaveGame.lastSaveFrame; }

    static Init(): void {
        SaveGame.lastSaveFrame = 0;
        SaveGame.WrapToCartridgeSize();
    }

    private static WrapToCartridgeSize(): void {
        SaveGame.adjustedBuffer = Uint8Array.wrap(SaveGame.buffer.buffer, 0, Cartridge.Data.RamBankCount * GB_EXT_RAM_BANK_SIZE);
    }

    static LoadSave(saveBuffer: Uint8Array): void {
        if (SaveGame.adjustedBuffer.byteLength != Cartridge.Data.RamBankCount * GB_EXT_RAM_BANK_SIZE) {
            SaveGame.WrapToCartridgeSize();
            if (Logger.verbose >= 1) {
                log('Adjusting Save Game buffer for the current game to size ' + SaveGame.adjustedBuffer.byteLength.toString())
            }
        }
        if (saveBuffer.byteLength > SaveGame.adjustedBuffer.byteLength) {
            if (Logger.verbose >= 1) {
                log(`Save of size ${saveBuffer.byteLength}B can't fit into this game's RAM of size ${SaveGame.adjustedBuffer.byteLength}B`)
            }
            return;
        }
        if (saveBuffer.byteLength < SaveGame.adjustedBuffer.byteLength && Logger.verbose >= 1) {
            log(`Save of size ${saveBuffer.byteLength}B too small for this game's RAM of size ${SaveGame.adjustedBuffer.byteLength}. Some data might be missing.`)
        }
        if (Logger.verbose >= 1) {
            log(`Loading save of size ${saveBuffer.byteLength}B...`);
        }
        memory.copy(GB_EXT_RAM_START, saveBuffer.dataStart, saveBuffer.byteLength);
    }

    static Save(): void {
        memory.copy(SaveGame.adjustedBuffer.dataStart, GB_EXT_RAM_START, SaveGame.adjustedBuffer.byteLength);
        SaveGame.lastSaveFrame = Ppu.currentFrame;
        if (Logger.verbose >= 1) {
            log(`Saving game of size ${SaveGame.adjustedBuffer.byteLength}B at frame ${SaveGame.lastSaveFrame}`)
        }
    }
}

export function loadSaveGame(saveBuffer: Uint8Array): void { SaveGame.LoadSave(saveBuffer) };
export function getLastSave(): Uint8Array { return SaveGame.GetBuffer() };
export function getLastSaveFrame(): u32 { return SaveGame.GetLastSaveFrame() };
