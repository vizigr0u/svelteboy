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
        // DMG post-boot register values
        store<u8>(GB_IO_START + 0x26, 0xF1); // NR52: APU on, CH1 active
        store<u8>(GB_IO_START + 0x25, 0xF3); // NR51: channel panning
        store<u8>(GB_IO_START + 0x24, 0x77); // NR50: volume
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return gbAddress >= SoundGbAddressStart && gbAddress <= SoundGbAddressEnd;
    }

    @inline
    static Load(gbAddress: u16): u8 {
        const low: u8 = <u8>(gbAddress & 0xFF);
        if (low == 0x15 || low == 0x1F || (low >= 0x27 && low < 0x30))
            return 0xFF;
        if (gbAddress == 0xFF26) {
            const stored = load<u8>(GB_IO_START + 0x26);
            const chBits = <u8>(
                (AudioRender.channel1.Enabled ? 1 : 0) |
                (AudioRender.channel2.Enabled ? 2 : 0) |
                (AudioRender.channel3.Enabled ? 4 : 0) |
                (AudioRender.channel4.Enabled ? 8 : 0)
            );
            return (stored & 0xF0) | chBits;
        }
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
