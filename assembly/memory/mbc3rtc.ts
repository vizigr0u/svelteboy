export function setRealTimeMs(ms: f64): void {
    MBC3RTC.SetRealTimeSec(<i64>(ms / 1000.0));
}

export const RTC_BLOB_SIZE: i32 = 48;
export const RTC_BLOB_SIZE_LEGACY: i32 = 44;

const SEC_PER_DAY: i64 = 86400;
const MAX_DAYS: i64 = 512;
const MAX_SEC: i64 = SEC_PER_DAY * MAX_DAYS;

const REG_S: i32 = 0;
const REG_M: i32 = 1;
const REG_H: i32 = 2;
const REG_DL: i32 = 3;
const REG_DH: i32 = 4;

const DH_DAY9: u8 = 0x01;
const DH_HALT: u8 = 0x40;
const DH_CARRY: u8 = 0x80;

@final
export class MBC3RTC {
    private static live: StaticArray<u8> = new StaticArray<u8>(5);
    private static latched: StaticArray<u8> = new StaticArray<u8>(5);
    private static accumSec: i64 = 0;
    private static baseEpoch: i64 = 0;
    private static epochSec: i64 = 0;
    // Guards against MBC3.Init running with epochSec=0
    // (i.e. before the host has primed the wall-clock).
    private static primed: bool = false;
    static Halted: bool = false;
    static Carry: bool = false;

    static SetRealTimeSec(s: i64): void {
        MBC3RTC.epochSec = s;
        if (!MBC3RTC.primed) {
            MBC3RTC.baseEpoch = s;
            MBC3RTC.primed = true;
        }
    }

    // Test-only: undo priming. Production code must not call this.
    static UnprimeForTest(): void {
        MBC3RTC.primed = false;
        MBC3RTC.epochSec = 0;
        MBC3RTC.baseEpoch = 0;
    }

    static IsPrimedForTest(): bool { return MBC3RTC.primed; }

    static Init(): void {
        for (let i: i32 = 0; i < 5; i++) {
            MBC3RTC.live[i] = 0;
            MBC3RTC.latched[i] = 0;
        }
        MBC3RTC.accumSec = 0;
        MBC3RTC.baseEpoch = MBC3RTC.epochSec;
        MBC3RTC.Halted = false;
        MBC3RTC.Carry = false;
        // Do NOT touch `primed`. It tracks whether the host has ever supplied wall-clock.
    }

    static Live(idx: i32): u8 { return MBC3RTC.live[idx]; }
    static Latched(idx: i32): u8 { return MBC3RTC.latched[idx]; }

    static Update(): void {
        if (MBC3RTC.Halted) return;
        const delta = MBC3RTC.epochSec - MBC3RTC.baseEpoch;
        if (delta <= 0) return;
        MBC3RTC.baseEpoch = MBC3RTC.epochSec;
        MBC3RTC.accumSec += delta;
        if (MBC3RTC.accumSec >= MAX_SEC) {
            MBC3RTC.Carry = true;
            MBC3RTC.accumSec = MBC3RTC.accumSec % MAX_SEC;
        }
        MBC3RTC.syncLiveFromAccum();
    }

    static WriteReg(idx: i32, val: u8): void {
        MBC3RTC.Update();
        switch (idx) {
            case REG_S: MBC3RTC.live[REG_S] = val & 0x3F; break;
            case REG_M: MBC3RTC.live[REG_M] = val & 0x3F; break;
            case REG_H: MBC3RTC.live[REG_H] = val & 0x1F; break;
            case REG_DL: MBC3RTC.live[REG_DL] = val; break;
            case REG_DH:
                MBC3RTC.live[REG_DH] = val & (DH_DAY9 | DH_HALT | DH_CARRY);
                MBC3RTC.Halted = (val & DH_HALT) != 0;
                MBC3RTC.Carry = (val & DH_CARRY) != 0;
                break;
        }
        MBC3RTC.accumSec = MBC3RTC.accumFromLive();
        MBC3RTC.baseEpoch = MBC3RTC.epochSec;
    }

    static Latch(): void {
        MBC3RTC.Update();
        for (let i: i32 = 0; i < 5; i++) MBC3RTC.latched[i] = MBC3RTC.live[i];
    }

    static ReadLatched(idx: i32): u8 { return MBC3RTC.latched[idx]; }

    static SerializeTo(buf: Uint8Array, offset: i32): void {
        MBC3RTC.Update();
        const avail = buf.byteLength - offset;
        assert(avail >= RTC_BLOB_SIZE_LEGACY, "RTC save buffer too small");
        for (let i: i32 = 0; i < 5; i++) {
            MBC3RTC.writeDword(buf, offset + i * 4, <u32>MBC3RTC.live[i]);
            MBC3RTC.writeDword(buf, offset + 20 + i * 4, <u32>MBC3RTC.latched[i]);
        }
        if (avail >= RTC_BLOB_SIZE) {
            MBC3RTC.writeQword(buf, offset + 40, MBC3RTC.epochSec);
        } else {
            MBC3RTC.writeDword(buf, offset + 40, <u32>MBC3RTC.epochSec);
        }
    }

    static DeserializeFrom(buf: Uint8Array, offset: i32, length: i32): void {
        assert(length == RTC_BLOB_SIZE_LEGACY || length == RTC_BLOB_SIZE, "RTC blob length must be 44 or 48");
        for (let i: i32 = 0; i < 5; i++) {
            MBC3RTC.live[i] = <u8>(MBC3RTC.readDword(buf, offset + i * 4) & 0xFF);
            MBC3RTC.latched[i] = <u8>(MBC3RTC.readDword(buf, offset + 20 + i * 4) & 0xFF);
        }
        const savedTs: i64 = length == RTC_BLOB_SIZE
            ? MBC3RTC.readQword(buf, offset + 40)
            : <i64><i32>MBC3RTC.readDword(buf, offset + 40);
        MBC3RTC.Halted = (MBC3RTC.live[REG_DH] & DH_HALT) != 0;
        MBC3RTC.Carry = (MBC3RTC.live[REG_DH] & DH_CARRY) != 0;
        MBC3RTC.accumSec = MBC3RTC.accumFromLive();
        MBC3RTC.baseEpoch = MBC3RTC.epochSec;
        if (!MBC3RTC.Halted && savedTs > 0 && MBC3RTC.epochSec > savedTs) {
            const elapsed = MBC3RTC.epochSec - savedTs;
            MBC3RTC.accumSec += elapsed;
            if (MBC3RTC.accumSec >= MAX_SEC) {
                MBC3RTC.Carry = true;
                MBC3RTC.accumSec = MBC3RTC.accumSec % MAX_SEC;
            }
            MBC3RTC.syncLiveFromAccum();
        }
    }

    private static accumFromLive(): i64 {
        const day9 = <i64>(MBC3RTC.live[REG_DH] & DH_DAY9);
        const days: i64 = (day9 << 8) | <i64>MBC3RTC.live[REG_DL];
        return <i64>MBC3RTC.live[REG_S]
            + 60 * <i64>MBC3RTC.live[REG_M]
            + 3600 * <i64>MBC3RTC.live[REG_H]
            + SEC_PER_DAY * days;
    }

    private static syncLiveFromAccum(): void {
        let a = MBC3RTC.accumSec;
        const days = a / SEC_PER_DAY;
        const rem = a % SEC_PER_DAY;
        MBC3RTC.live[REG_S] = <u8>(rem % 60);
        MBC3RTC.live[REG_M] = <u8>((rem / 60) % 60);
        MBC3RTC.live[REG_H] = <u8>(rem / 3600);
        MBC3RTC.live[REG_DL] = <u8>(days & 0xFF);
        const dh: u8 = <u8>((days >> 8) & 1)
            | (MBC3RTC.Halted ? DH_HALT : 0)
            | (MBC3RTC.Carry ? DH_CARRY : 0);
        MBC3RTC.live[REG_DH] = dh;
    }

    private static writeDword(buf: Uint8Array, off: i32, v: u32): void {
        buf[off + 0] = <u8>(v & 0xFF);
        buf[off + 1] = <u8>((v >> 8) & 0xFF);
        buf[off + 2] = <u8>((v >> 16) & 0xFF);
        buf[off + 3] = <u8>((v >> 24) & 0xFF);
    }

    private static writeQword(buf: Uint8Array, off: i32, v: i64): void {
        for (let i: i32 = 0; i < 8; i++) {
            const shift: i64 = <i64>i * 8;
            buf[off + i] = <u8>((v >> shift) & 0xFF);
        }
    }

    private static readDword(buf: Uint8Array, off: i32): u32 {
        return <u32>buf[off]
            | (<u32>buf[off + 1] << 8)
            | (<u32>buf[off + 2] << 16)
            | (<u32>buf[off + 3] << 24);
    }

    private static readQword(buf: Uint8Array, off: i32): i64 {
        let v: i64 = 0;
        for (let i: i32 = 0; i < 8; i++) {
            const shift: i64 = <i64>i * 8;
            v = v | (<i64>buf[off + i] << shift);
        }
        return v;
    }
}
