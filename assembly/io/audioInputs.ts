import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { IO } from "./io";

const AUDIO_IO_START: u16 = 0xFF10;
const AUDIO_IO_LAST_ADDRESS: u16 = 0xFF3F;

function log(s: string): void {
    Logger.Log("AUD: " + s);
}

@final
export class AudioInput {
    static Handles(gbAddress: u16): boolean {
        return (gbAddress >= AUDIO_IO_START && gbAddress <= AUDIO_IO_LAST_ADDRESS);
    }

    static Load(gbAddress: u16): u8 {
        if (Logger.verbose >= 3)
            log(`Unhandled Audio read at [${uToHex<u16>(gbAddress)}]`);
        return IO.MemLoad<u8>(gbAddress);
    }

    static Store(gbAddress: u16, value: u8): void {
        if (Logger.verbose >= 3)
            log(`Unhandled Audio write: ${uToHex(value)} at [${uToHex<u16>(gbAddress)}]`);
        IO.MemStore<u8>(gbAddress, value);
    }
}