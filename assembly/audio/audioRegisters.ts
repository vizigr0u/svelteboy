import { GB_IO_START } from "../memory/memoryConstants";
import { uToHex } from "../utils/stringUtils";
import { ChannelData, AudioRegisterType } from "./audioTypes";

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
        if (reg >= <u8>AudioRegisterType.WaveStart && reg <= <u8>AudioRegisterType.WaveEnd)
            return newValue;
        const t: AudioRegisterType = <AudioRegisterType>(reg);
        switch (t) {
            case AudioRegisterType.NR11_C1Length:
            case AudioRegisterType.NR12_C1Volume:
            case AudioRegisterType.NR13_C1PeriodLo:
            case AudioRegisterType.NR21_C2Length:
            case AudioRegisterType.NR22_C2Volume:
            case AudioRegisterType.NR23_C2PeriodLo:
            case AudioRegisterType.NR31_C3Length:
            case AudioRegisterType.NR33_C3PeriodLo:
            case AudioRegisterType.NR42_C4Volume:
            case AudioRegisterType.NR43_C4Freq:
            case AudioRegisterType.NR50_Volume:
            case AudioRegisterType.NR51_Panning:
                return newValue;
            case AudioRegisterType.NR10_C1Sweep:
                return (newValue & 0b01111111) | 0b10000000;
            case AudioRegisterType.NR14_C1PeriodHi:
            case AudioRegisterType.NR24_C2PeriodHi:
            case AudioRegisterType.NR34_C3PeriodHi:
                return (newValue & 0b11000111) | 0b00111000;
            case AudioRegisterType.NR30_C3Enable:
                return (newValue & 0b10000000) | 0b01111111;
            case AudioRegisterType.NR32_C3Volume:
                return (newValue & 0b01100000) | 0b10011111;
            case AudioRegisterType.NR44_C4Control:
                return (newValue & 0b11000000) | 0b00111111;
            case AudioRegisterType.NR41_C4Length:
                return (newValue & 0b00111111) | 0b11000000;
            case AudioRegisterType.NR52_SoundOnOff:
                return (newValue & 0b10001111) | 0b01110000;
            default:
                console.log("Unexpected register: " + uToHex<u8>(reg))
                unreachable();
                return 0xFF;
        }
    }
}
