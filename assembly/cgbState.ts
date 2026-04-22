@final
export class CgbState {
    static _isCGB: boolean = false;
    static _vramBank: u32 = 0;
    static _wramBank: u32 = 1;

    @inline static get isCgbMode(): boolean { return CgbState._isCGB; }
    @inline static get vramBank(): u32 { return CgbState._vramBank; }
    @inline static get wramBank(): u32 { return CgbState._wramBank; }

    static setIsCGB(value: boolean): void { CgbState._isCGB = value; }
    static setVramBank(bank: u32): void { CgbState._vramBank = bank; }
    static setWramBank(bank: u32): void { CgbState._wramBank = bank; }
}

export function isCgbMode(): boolean {
    return CgbState.isCgbMode;
}
