import { IO } from "../io/io";
import { uToHex } from "../utils/stringUtils";
import { Cpu } from "./cpu";

export enum IntType {
    VBlank = 0x1,
    LcdSTAT = 0x2,
    Timer = 0x4,
    Serial = 0x8,
    Joypad = 0x10
}

function CheckAndRunInterrupt(int: IntType): boolean {
    if (Interrupt.HasRequest(int) && Interrupt.IsEnabled(int)) {
        const intAddress: u16 = Interrupt.GetHandlerAddress(int);
        Cpu.PushToSP(Cpu.ProgramCounter);
        Cpu.ProgramCounter = intAddress;
        Interrupt.Request(int, 0);
        Cpu.isHalted = false;
        Interrupt.masterEnabled = false;
        return true;
    }
    return false;
}

const IF_ADDRESS: u16 = 0xFF0F;
const IE_ADDRESS: u16 = 0xFFFF;

@final
export class Interrupt {
    static masterEnabled: boolean = false;

    static Init(): void {
        Interrupt.masterEnabled = false;
        Interrupt.SetRequests(0xE1);

    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return gbAddress == IF_ADDRESS || gbAddress == IE_ADDRESS;
    }

    static GetHandlerAddress(int: IntType): u16 {
        switch (int) {
            case IntType.VBlank: return 0x40;
            case IntType.LcdSTAT: return 0x48;
            case IntType.Timer: return 0x50;
            case IntType.Serial: return 0x58;
            case IntType.Joypad: return 0x60;
            default:
                assert(false, 'Unexpected Int flag value: ' + uToHex<u8>(<u8>int));
        }
        return 0;
    }

    static HandleInterrupts(): void {
        if (CheckAndRunInterrupt(IntType.VBlank)) {

        } else if (CheckAndRunInterrupt(IntType.LcdSTAT)) {

        } else if (CheckAndRunInterrupt(IntType.Timer)) {

        } else if (CheckAndRunInterrupt(IntType.Serial)) {

        } else if (CheckAndRunInterrupt(IntType.Joypad)) {

        }
    }

    @inline
    static Requests(): u8 {
        return IO.MemLoad<u8>(IF_ADDRESS);
    }

    @inline
    static GetEnabled(): u8 {
        return IO.MemLoad<u8>(IE_ADDRESS);
    }

    @inline
    static SetRequests(flags: u8): void {
        IO.MemStore<u8>(IF_ADDRESS, flags);
    }

    static Request(flag: IntType, enabled: bool = 1): void {
        if (enabled) {
            Interrupt.SetRequests(Interrupt.Requests() | <u8>flag);
        } else {
            Interrupt.SetRequests(Interrupt.Requests() & ~<u8>(flag));
        }
    }

    @inline
    static HasRequest(flag: IntType): boolean {
        return (Interrupt.Requests() & <u8>(flag)) == <u8>(flag);
    }

    @inline
    static IsEnabled(flag: IntType): boolean {
        return (Interrupt.GetEnabled() & <u8>(flag)) == <u8>(flag);
    }
}
