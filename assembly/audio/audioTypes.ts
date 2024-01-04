export enum AudioChannel {
    Left = 0,
    Right = 1
}

@unmanaged
export class ChannelData {
    Sweep: u8;
    Length: u8;
    Volume: u8;
    PeriodLow: u8;
    PeriodHigh: u8;
}

export enum AudioRegisterType {
    Offset = 0x10,
    NR10_C1Sweep = 0x10,
    NR11_C1Length = 0x11,
    NR12_C1Volume = 0x12,
    NR13_C1PeriodLo = 0x13,
    NR14_C1PeriodHi = 0x14,
    NR21_C2Length = 0x16,
    NR22_C2Volume = 0x17,
    NR23_C2PeriodLo = 0x18,
    NR24_C2PeriodHi = 0x19,
    NR30_C3Enable = 0x1A,
    NR31_C3Length = 0x1B,
    NR32_C3Volume = 0x1C,
    NR33_C3PeriodLo = 0x1D,
    NR34_C3PeriodHi = 0x1E,
    NR41_C4Length = 0x20,
    NR42_C4Volume = 0x21,
    NR43_C4Freq = 0x22,
    NR44_C4Control = 0x23,
    NR50_Volume = 0x24,
    NR51_Panning = 0x25,
    NR52_SoundOnOff = 0x26,
    WaveStart = 0x30,
    WaveEnd = 0x3F
}

export function getRegisterIndex(reg: AudioRegisterType): i32 { return <i32>reg - <i32>AudioRegisterType.Offset; };

@unmanaged
export class AudioEvent {
    FrameSampleIndex: u32;
    Type: u8;
    Value: u8;

    @inline get RegisterIndex(): i32 { return getRegisterIndex(this.Type); };
}
