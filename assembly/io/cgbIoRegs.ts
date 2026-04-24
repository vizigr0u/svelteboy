import { CgbState } from "../cgbState";
import { MemoryMap } from "../memory/memoryMap";

const KEY0_ADDRESS: u16 = 0xFF4C;
const RP_ADDRESS: u16 = 0xFF56;
const OPRI_ADDRESS: u16 = 0xFF6C;
const FF72_ADDRESS: u16 = 0xFF72;
const FF73_ADDRESS: u16 = 0xFF73;
const FF74_ADDRESS: u16 = 0xFF74;
const FF75_ADDRESS: u16 = 0xFF75;
const PCM12_ADDRESS: u16 = 0xFF76;
const PCM34_ADDRESS: u16 = 0xFF77;

@final
export class CgbIoRegs {
    static _key0: u8 = 0;
    static _rp: u8 = 0;
    static _opri: u8 = 0;
    static _ff72: u8 = 0;
    static _ff73: u8 = 0;
    static _ff74: u8 = 0;
    static _ff75: u8 = 0;

    static Init(): void {
        CgbIoRegs._key0 = 0;
        CgbIoRegs._rp = 0;
        CgbIoRegs._opri = 0;
        CgbIoRegs._ff72 = 0;
        CgbIoRegs._ff73 = 0;
        CgbIoRegs._ff74 = 0;
        CgbIoRegs._ff75 = 0;
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        switch (gbAddress) {
            case KEY0_ADDRESS:
            case RP_ADDRESS:
            case OPRI_ADDRESS:
            case FF72_ADDRESS:
            case FF73_ADDRESS:
            case FF74_ADDRESS:
            case FF75_ADDRESS:
            case PCM12_ADDRESS:
            case PCM34_ADDRESS:
                return true;
        }
        return false;
    }

    static Store(gbAddress: u16, value: u8): void {
        if (!CgbState.isCgbMode) return;
        switch (gbAddress) {
            case KEY0_ADDRESS:
                // Locked after boot ROM disabled ($FF50 write).
                if (MemoryMap.useBootRom) CgbIoRegs._key0 = value;
                return;
            case RP_ADDRESS:
                // Bit 0 R/W (Emit), bits 7-6 R/W (Read enable). Others unused.
                CgbIoRegs._rp = value & 0xC1;
                return;
            case OPRI_ADDRESS:
                CgbIoRegs._opri = value & 0x01;
                return;
            case FF72_ADDRESS:
                CgbIoRegs._ff72 = value;
                return;
            case FF73_ADDRESS:
                CgbIoRegs._ff73 = value;
                return;
            case FF74_ADDRESS:
                CgbIoRegs._ff74 = value;
                return;
            case FF75_ADDRESS:
                CgbIoRegs._ff75 = value & 0x70;
                return;
            case PCM12_ADDRESS:
            case PCM34_ADDRESS:
                // Read-only.
                return;
        }
    }

    static Load(gbAddress: u16): u8 {
        if (!CgbState.isCgbMode) return 0xFF;
        switch (gbAddress) {
            case KEY0_ADDRESS:
                return CgbIoRegs._key0;
            case RP_ADDRESS:
                // Bit 1 Receiving: no IR peer → always 1. Unused 5-2 read as 1.
                return (CgbIoRegs._rp & 0xC1) | 0x3E;
            case OPRI_ADDRESS:
                return (CgbIoRegs._opri & 0x01) | 0xFE;
            case FF72_ADDRESS:
                return CgbIoRegs._ff72;
            case FF73_ADDRESS:
                return CgbIoRegs._ff73;
            case FF74_ADDRESS:
                return CgbIoRegs._ff74;
            case FF75_ADDRESS:
                return CgbIoRegs._ff75 | 0x8F;
            case PCM12_ADDRESS:
            case PCM34_ADDRESS:
                // Channel digital outputs not tracked; return silent (0) — HW never returns 0xFF here.
                return 0x00;
        }
        return 0xFF;
    }
}
