@final
export class CgbState {
    static _isCGB: boolean = false;
    static _vramBank: u32 = 0;

    @inline static get isCgbMode(): boolean { return CgbState._isCGB; }
    @inline static get vramBank(): u32 { return CgbState._vramBank; }

    static setIsCGB(value: boolean): void { CgbState._isCGB = value; }
    static setVramBank(bank: u32): void { CgbState._vramBank = bank; }
}

export function isCgbMode(): boolean {
    return CgbState.isCgbMode;
}
