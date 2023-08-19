import { Logger, log } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { IO } from "./io";

const JOYPAD_ADDRESS: u16 = 0xFF00;

@final
export class Joypad {
    static Handles(gbAddress: u16): boolean {
        return (gbAddress == JOYPAD_ADDRESS);
    }

    static Load(): u8 {
        if (Logger.verbose >= 3)
            log(`Unhandled Joypad read at [${uToHex<u16>(JOYPAD_ADDRESS)}]`);
        return IO.MemLoad<u8>(JOYPAD_ADDRESS);
    }

    static Store(value: u8): void {
        if (Logger.verbose >= 1)
            log(`Unhandled Joypad write: ${uToHex(value)} at [${uToHex<u16>(JOYPAD_ADDRESS)}]`);
        IO.MemStore<u8>(JOYPAD_ADDRESS, value);
    }
}
