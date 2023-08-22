import { GB_IO_START } from "../cpu/memoryMap";
import { Logger, log } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";

const JOYPAD_ADDRESS: u16 = 0xFF00;

@final
export class Joypad {
    static Init(): void {
        store<u8>(GB_IO_START, 0xDF);
    }

    static Handles(gbAddress: u16): boolean {
        return (gbAddress == JOYPAD_ADDRESS);
    }

    static Load(): u8 {
        if (Logger.verbose >= 3)
            log(`Unhandled Joypad read at [${uToHex<u16>(JOYPAD_ADDRESS)}]`);
        return load<u8>(GB_IO_START);
    }

    static Store(value: u8): void {
        if (Logger.verbose >= 3)
            log(`Unhandled Joypad write: ${uToHex(value)} at [${uToHex<u16>(JOYPAD_ADDRESS)}]`);
        if (Logger.verbose >= 2 && (value & 0x0F) != 0) {
            log('Unexpected write to readonly joypad bits: ' + uToHex<u8>(value));
        }
        store<u8>(GB_IO_START, (value & 0xF0) | 0xCF);
    }
}
