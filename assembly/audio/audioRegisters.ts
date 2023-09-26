import { GB_IO_START } from "../memory/memoryConstants";
import { ChannelData, RegisterType } from "./audioTypes";

export const SoundGbAddressStart: u16 = 0xFF10;
export const SoundDataSize: u16 = 0x30;
export const SoundGbAddressEnd: u16 = SoundGbAddressStart + SoundDataSize - 1;

export const SoundDataPtr: usize = GB_IO_START + 0x10;
export const Channel1Data: ChannelData = changetype<ChannelData>(GB_IO_START + 0x10);
export const Channel2Data: ChannelData = changetype<ChannelData>(GB_IO_START + 0x15);
export const Channel3Data: ChannelData = changetype<ChannelData>(GB_IO_START + 0x1A);
export const Channel4Data: ChannelData = changetype<ChannelData>(GB_IO_START + 0x1F);

export const WavePtr: usize = GB_IO_START + 0x30;
export const WaveSize: i32 = 0x10;
export const WaveMask: i32 = WaveSize - 1;

@final
export class AudioRegisters {
    @inline
    static WaveAt(i: i32): u8 {
        return load<u8>(WavePtr + (i + WaveSize) & WaveMask);
    }

    static getChange(reg: u8, newValue: u8): u8 {
        if (reg >= <u8>RegisterType.WaveStart && reg <= <u8>RegisterType.WaveEnd)
            return newValue;
        const t: RegisterType = <RegisterType>(reg);
        switch (t) {
            case RegisterType.NR11_C1Length:
            case RegisterType.NR12_C1Volume:
            case RegisterType.NR13_C1PeriodLo:
            case RegisterType.NR21_C2Length:
            case RegisterType.NR22_C2Volume:
            case RegisterType.NR23_C2PeriodLo:
            case RegisterType.NR31_C3Length:
            case RegisterType.NR33_C3PeriodLo:
            case RegisterType.NR42_C4Volume:
            case RegisterType.NR43_C4Freq:
            case RegisterType.NR51_Panning:
                return newValue;
            case RegisterType.NR10_C1Sweep:
                return (newValue & 0b01111111) | 0b10000000;
            case RegisterType.NR14_C1PeriodHi:
            case RegisterType.NR24_C2PeriodHi:
            case RegisterType.NR34_C3PeriodHi:
                return (newValue & 0b11000111) | 0b00111000;
            case RegisterType.NR30_C3Enable:
                return (newValue & 0b10000000) | 0b01111111;
            case RegisterType.NR32_C3Volume:
                return (newValue & 0b01100000) | 0b10011111;
            case RegisterType.NR44_C4Control:
                return (newValue & 0b11000000) | 0b00111111;
            case RegisterType.NR41_C4Length:
                return (newValue & 0b00111111) | 0b11000000;
            case RegisterType.NR52_SoundOnOff:
                return (newValue & 0b10001111) | 0b01110000;
            default:
                unreachable();
                return 0xFF;
        }
    }
}
