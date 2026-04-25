import { GB_VIDEO_BANK_SIZE, GB_WRAM_BANK_SIZE } from "./memory/memoryConstants";

@final
export class CgbState {
    static _isCGB: boolean = false;
    static _vramBank: u32 = 0;
    static _wramBank: u32 = 1;
    static _vramBankOffset: u32 = 0;
    static _wramBankOffset: u32 = 0;
    static _doubleSpeed: boolean = false;
    static _doubleSpeedShift: u8 = 0;
    static _key1: u8 = 0;
    static masterCycleCount: u64 = 0;

    @inline static get isCgbMode(): boolean { return CgbState._isCGB; }
    @inline static get vramBank(): u32 { return CgbState._vramBank; }
    @inline static get wramBank(): u32 { return CgbState._wramBank; }
    @inline static get vramBankOffset(): u32 { return CgbState._vramBankOffset; }
    @inline static get wramBankOffset(): u32 { return CgbState._wramBankOffset; }
    @inline static get doubleSpeed(): boolean { return CgbState._doubleSpeed; }
    @inline static get doubleSpeedShift(): u8 { return CgbState._doubleSpeedShift; }
    @inline static get key1(): u8 { return CgbState._key1; }

    static setIsCGB(value: boolean): void { CgbState._isCGB = value; }
    static setVramBank(bank: u32): void {
        CgbState._vramBank = bank;
        CgbState._vramBankOffset = bank * GB_VIDEO_BANK_SIZE;
    }
    static setWramBank(bank: u32): void {
        CgbState._wramBank = bank;
        CgbState._wramBankOffset = (bank - 1) * GB_WRAM_BANK_SIZE;
    }
    static setDoubleSpeed(value: boolean): void {
        CgbState._doubleSpeed = value;
        CgbState._doubleSpeedShift = value ? 1 : 0;
    }
    static setKey1(value: u8): void { CgbState._key1 = value; }

    static Reset(): void {
        CgbState.setVramBank(0);
        CgbState.setWramBank(1);
        CgbState.setDoubleSpeed(false);
        CgbState.setKey1(0);
    }

    static Serialize(p: usize): usize {
        store<u8>(p, <u8>CgbState._vramBank); p += 1;
        store<u8>(p, <u8>CgbState._wramBank); p += 1;
        store<u8>(p, CgbState._doubleSpeed ? 1 : 0); p += 1;
        store<u8>(p, CgbState._key1); p += 1;
        return p;
    }

    static Deserialize(p: usize): usize {
        CgbState.setVramBank(<u32>load<u8>(p)); p += 1;
        const wb = <u32>load<u8>(p); p += 1;
        CgbState.setWramBank(wb == 0 ? 1 : wb);
        CgbState.setDoubleSpeed(load<u8>(p) != 0); p += 1;
        CgbState.setKey1(load<u8>(p)); p += 1;
        return p;
    }
}

export const CGB_STATE_SERIALIZED_SIZE: u32 = 4;

export function isCgbMode(): boolean {
    return CgbState.isCgbMode;
}

export function isDoubleSpeed(): boolean {
    return CgbState.doubleSpeed;
}
