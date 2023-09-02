import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { getCartridgeTypeName } from "../debug/symbols";
import { CartridgeType } from "../metadata";
import { uToHex } from "../utils/stringUtils";
import { MemoryMap } from "./memoryMap";

function log(s: string): void {
    Logger.Log("MBC: " + s);
}

function getRomBankCount(headerRomSizeValue: u8): u16 {
    switch (headerRomSizeValue) {
        case 0x00:
            return 2;
        case 0x01:
            return 4;
        case 0x02:
            return 8;
        case 0x03:
            return 16;
        case 0x04:
            return 32;
        case 0x05:
            return 64;
        case 0x06:
            return 128;
        case 0x07:
            return 256;
        case 0x08:
            return 512;
        case 0x52:
            return 72;
        case 0x53:
            return 80;
        case 0x54:
            return 96;
        default:
            assert(false, 'Unexpected Header ROM Size value: ' + uToHex<u8>(headerRomSizeValue));
            unreachable();
            return 0;
    }
}

function getRamBankCount(headerRamSizeValue: u8): u16 {
    switch (headerRamSizeValue) {
        case 0x00:
            return 0;
        case 0x01:
            return 0;
        case 0x02:
            return 1;
        case 0x03:
            return 4;
        case 0x04:
            return 16;
        case 0x05:
            return 8;
        default:
            assert(false, 'Unexpected Header RAM Size value: ' + uToHex<u8>(headerRamSizeValue));
            unreachable();
            return 0;
    }
}

function NOMBC_Handler(gbAddress: u16, value: u8): void {
    // if (gbAddress < 0x8000) {
    if (Logger.verbose >= 2) {
        log('Ignoring writing to ROM with cartridge with no MBC')
    }
    return;
    // }
    // if (gbAddress >= 0xA000 && gbAddress <= 0xBFFF) {
    //     if (Logger.verbose >= 3) {
    //         log('Writing to RAM')
    //     }
    //     if (MBC.ramBankCount == 0 && Logger.verbose >= 2) {
    //         log('Unexpected Writing to RAM in Cartridge that says it doesn\'t have RAM')
    //     }
    //     store<u8>(MemoryMap.GBToMemory(gbAddress), value);
    //     return;
    // }
    assert(false, 'Unexpected call to HandleWrite for address ' + uToHex<u16>(gbAddress));
}

function MBC1_Handler(gbAddress: u16, value: u8): void {
    const hiByte: u8 = <u8>(gbAddress >> 12);
    switch (hiByte) {
        case 0x0:
        case 0x1:
            MBC.enableRam((value & 0xF) == 0xA);
            return;
        case 0x2:
        case 0x3:
            const lo: u8 = (value & 0x1F) & MBC.romBankCount;
            const hi = (MemoryMap.currentRomBankIndex + 1) & 0b110000;
            const bankNumber = hi | lo;
            MemoryMap.currentRomBankIndex = bankNumber == 0 ? 0 : bankNumber - 1; // ROM bank 1 means extra bank index is 1
            return;
        case 0x4:
        case 0x5:
            // TODO: RAM or Upperbit select
            return;
        case 0x6:
        case 0x7:
            if (MBC.ramBankCount <= 1 && MBC.ramBankCount <= 32) {
                if (Logger.verbose >= 1) {
                    log('Ignoring MBC write to range 0x6000-0x7FFF on smaller cartridge.')
                }
                return;
            }
            // TODO: Banking mode select
            return;
    }
}

@final
export class MBC {
    static currentType: CartridgeType = CartridgeType.ROM_ONLY;
    static ramBankCount: u16;
    static romBankCount: u16;
    static ramEnabled: boolean = false;

    static Init(): void {
        MBC.currentType = Cartridge.Data.cartridgeType;
        MBC.romBankCount = getRomBankCount(Cartridge.Data.romSize);
        MBC.ramBankCount = getRamBankCount(Cartridge.Data.ramSize);
        MBC.ramEnabled = MBC.currentType == CartridgeType.ROM_ONLY ? true : false;
    }

    static enableRam(enabled: boolean = true): void {
        MBC.ramEnabled = enabled;
        // TODO: save when disabled?
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        switch (MBC.currentType) {
            case CartridgeType.ROM_ONLY:
                NOMBC_Handler(gbAddress, value);
                return;
            case CartridgeType.MBC1:
            case CartridgeType.MBC1_RAM:
            case CartridgeType.MBC1_RAM_BATTERY:
                MBC1_Handler(gbAddress, value);
                return;
            default:
                if (Logger.verbose >= 1) {
                    log('Unhandled write to RAM or ROM with cartridge of type ' + getCartridgeTypeName(MBC.currentType));
                }
        }
    }
}
