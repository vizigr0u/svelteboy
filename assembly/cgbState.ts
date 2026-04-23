@final
export class CgbState {
    static _isCGB: boolean = false;
    static _vramBank: u32 = 0;
    static _wramBank: u32 = 1;
    static _doubleSpeed: boolean = false;
    static _key1: u8 = 0;
    static masterCycleCount: u64 = 0;

    @inline static get isCgbMode(): boolean { return CgbState._isCGB; }
    @inline static get vramBank(): u32 { return CgbState._vramBank; }
    @inline static get wramBank(): u32 { return CgbState._wramBank; }
    @inline static get doubleSpeed(): boolean { return CgbState._doubleSpeed; }
    @inline static get key1(): u8 { return CgbState._key1; }

    static setIsCGB(value: boolean): void { CgbState._isCGB = value; }
    static setVramBank(bank: u32): void { CgbState._vramBank = bank; }
    static setWramBank(bank: u32): void { CgbState._wramBank = bank; }
    static setDoubleSpeed(value: boolean): void { CgbState._doubleSpeed = value; }
    static setKey1(value: u8): void { CgbState._key1 = value; }
}

export function isCgbMode(): boolean {
    return CgbState.isCgbMode;
}

export function isDoubleSpeed(): boolean {
    return CgbState.doubleSpeed;
}
