import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { Ppu } from "../io/video/ppu";
import { GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_SIZE, GB_EXT_RAM_START } from "./memoryConstants";
import { MBC3RTC, RTC_BLOB_SIZE, RTC_BLOB_SIZE_LEGACY } from "./mbc3rtc";

function log(s: string): void {
    Logger.Log('SAV: ' + s);
}

@final export class SaveGame {
    private static buffer: Uint8Array = new Uint8Array(GB_EXT_RAM_SIZE + RTC_BLOB_SIZE);
    private static adjustedBuffer: Uint8Array = Uint8Array.wrap(SaveGame.buffer.buffer, 0, SaveGame.buffer.byteLength);
    private static lastSaveFrame: u32 = 0;

    static GetBuffer(): Uint8Array { return SaveGame.adjustedBuffer; }
    static GetLastSaveFrame(): u32 { return SaveGame.lastSaveFrame; }

    static Init(): void {
        SaveGame.lastSaveFrame = 0;
        SaveGame.WrapToCartridgeSize();
    }

    private static WrapToCartridgeSize(): void {
        const ramBytes = Cartridge.Data.RamBankCount * GB_EXT_RAM_BANK_SIZE;
        const trailing = Cartridge.Data.HasRTC ? RTC_BLOB_SIZE : 0;
        SaveGame.adjustedBuffer = Uint8Array.wrap(SaveGame.buffer.buffer, 0, ramBytes + trailing);
    }

    static LoadSave(saveBuffer: Uint8Array): void {
        const ramBytes: i32 = Cartridge.Data.RamBankCount * GB_EXT_RAM_BANK_SIZE;
        if (SaveGame.adjustedBuffer.byteLength != ramBytes + (Cartridge.Data.HasRTC ? RTC_BLOB_SIZE : 0)) {
            SaveGame.WrapToCartridgeSize();
            if (Logger.verbose >= 1) {
                log('Adjusting Save Game buffer for the current game to size ' + SaveGame.adjustedBuffer.byteLength.toString())
            }
        }
        const inLen: i32 = saveBuffer.byteLength;
        let rtcLen: i32 = 0;
        if (Cartridge.Data.HasRTC) {
            if (inLen == ramBytes + RTC_BLOB_SIZE) rtcLen = RTC_BLOB_SIZE;
            else if (inLen == ramBytes + RTC_BLOB_SIZE_LEGACY) rtcLen = RTC_BLOB_SIZE_LEGACY;
            else if (Logger.verbose >= 1) {
                log(`RTC cart save ${inLen}B has no trailing RTC blob (expected ${ramBytes + RTC_BLOB_SIZE} or ${ramBytes + RTC_BLOB_SIZE_LEGACY})`)
            }
        }
        const ramCopy: i32 = inLen - rtcLen;
        if (ramCopy > ramBytes) {
            if (Logger.verbose >= 1) {
                log(`Save RAM portion ${ramCopy}B can't fit into this game's RAM of size ${ramBytes}B`)
            }
            return;
        }
        if (ramCopy < ramBytes && Logger.verbose >= 1) {
            log(`Save RAM portion ${ramCopy}B too small for this game's RAM of size ${ramBytes}B. Some data might be missing.`)
        }
        if (Logger.verbose >= 1) {
            log(`Loading save of size ${inLen}B (ram=${ramCopy}B, rtc=${rtcLen}B)`);
        }
        if (ramCopy > 0) {
            memory.copy(GB_EXT_RAM_START, saveBuffer.dataStart, ramCopy);
        }
        if (rtcLen > 0) {
            MBC3RTC.DeserializeFrom(saveBuffer, ramCopy, rtcLen);
        }
    }

    static Save(): void {
        const ramBytes: i32 = Cartridge.Data.RamBankCount * GB_EXT_RAM_BANK_SIZE;
        if (SaveGame.adjustedBuffer.byteLength != ramBytes + (Cartridge.Data.HasRTC ? RTC_BLOB_SIZE : 0)) {
            SaveGame.WrapToCartridgeSize();
        }
        if (ramBytes > 0) {
            memory.copy(SaveGame.adjustedBuffer.dataStart, GB_EXT_RAM_START, ramBytes);
        }
        if (Cartridge.Data.HasRTC) {
            MBC3RTC.SerializeTo(SaveGame.adjustedBuffer, ramBytes);
        }
        SaveGame.lastSaveFrame = Ppu.currentFrame;
        if (Logger.verbose >= 2) {
            log(`Saving game of size ${SaveGame.adjustedBuffer.byteLength}B at frame ${SaveGame.lastSaveFrame}`)
        }
    }
}

export function loadSaveGame(saveBuffer: Uint8Array): void { SaveGame.LoadSave(saveBuffer) };
export function getLastSave(): Uint8Array { return SaveGame.GetBuffer() };
export function getLastSaveFrame(): u32 { return SaveGame.GetLastSaveFrame() };
