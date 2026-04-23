import { CgbState } from "../cgbState";

const SVBK_ADDRESS: u16 = 0xFF70;

@final
export class WramBank {
    @inline static get bank(): u32 { return CgbState.wramBank; }

    static Init(): void {
        CgbState.setWramBank(1);
    }

    @inline static Handles(gbAddress: u16): boolean {
        return CgbState.isCgbMode && gbAddress == SVBK_ADDRESS;
    }

    static Store(value: u8): void {
        const b = <u32>(value & 7);
        CgbState.setWramBank(b == 0 ? 1 : b);
    }

    @inline static Load(): u8 {
        return <u8>(CgbState.wramBank | 0xF8);
    }
}
