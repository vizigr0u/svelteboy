import { GB_IO_START } from "../cpu/memoryMap";
import { Logger, log } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";

const JOYPAD_ADDRESS: u16 = 0xFF00;

@final
export class Joypad {
    static Init(): void {
        store<u8>(GB_IO_START, 0xFF);
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
        const filteredValue = value & 0x0F;
        if (Logger.verbose >= 2 && filteredValue != value) {
            log('Unexpected write to readonly joypad bits');
        }
        store<u8>(GB_IO_START, filteredValue);
    }
}
