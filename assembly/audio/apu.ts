import { Logger } from "../debug/logger";
import { GB_IO_START } from "../memory/memoryConstants";
import { SoundGbAddressStart, SoundGbAddressEnd, AudioRegisters } from "./audioRegisters";
import { AudioRender } from "./render";

export function log(s: string): void {
    Logger.Log("AUD: " + s);
}

@final
export class APU {
    static Init(): void {
        if (Logger.verbose >= 2) {
            log('Initializing Audio');
        }
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return gbAddress >= SoundGbAddressStart && gbAddress <= SoundGbAddressEnd;
    }

    @inline
    static Load(gbAddress: u16): u8 {
        return load<u8>(GB_IO_START + gbAddress - 0xFF00);
    }

    static Store(gbAddress: u16, value: u8): void {
        const low: u8 = <u8>(gbAddress & 0xFF);
        if (low == 0x15 || low == 0x1F || (low >= 0x27 && low < 0x30))
            return;
        const newValue = AudioRegisters.getChange(low, value);
        AudioRender.EnqueueEvent(<u8>(gbAddress & 0xFF), newValue);
        store<u8>(GB_IO_START + gbAddress - 0xFF00, newValue);
    }
}
