import { Interrupt, IntType } from "../cpu/interrupts";
import { MemoryMap } from "../cpu/memoryMap";

const DIV_ADDRESS: u16 = 0xFF04;
const TIMA_ADDRESS: u16 = 0xFF05;
const TMA_ADDRESS: u16 = 0xFF06;
const TAC_ADDRESS: u16 = 0xFF07;

@final
export class Timer {
    private static readonly InitialDiv: u16 = 0xAC00; // 0xABCC; // value found on boot in cgb emu
    private static readonly InitialTac: u8 = 0; // 0xF8; // value found on boot in cgb emu

    static internalDiv: u16 = Timer.InitialDiv;

    static Div(): u8 { return <u8>(Timer.internalDiv >> 8); }
    static Tima: u8 = 0;
    static Tma: u8 = 0;
    static Tac: u8 = Timer.InitialTac;

    static Init(): void {
        Timer.internalDiv = Timer.InitialDiv;
        Timer.Tima = 0;
        Timer.Tma = 0;
        Timer.Tac = MemoryMap.useBootRom ? 0x00 : Timer.InitialTac;
    }

    static Tick(): void {
        const prevDiv: u16 = Timer.internalDiv;
        Timer.internalDiv++;
        let update = false;
        switch (Timer.Tac & 0b11) {
            case 0b00:
                update = (prevDiv & (1 << 9)) != 0 && (Timer.internalDiv & (1 << 9)) == 0;
                break;
            case 0b01:
                update = (prevDiv & (1 << 3)) != 0 && (Timer.internalDiv & (1 << 3)) == 0;
                break;
            case 0b10:
                update = (prevDiv & (1 << 5)) != 0 && (Timer.internalDiv & (1 << 5)) == 0;
                break;
            case 0b1:
                update = (prevDiv & (1 << 7)) != 0 && (Timer.internalDiv & (1 << 7)) == 0;
                break;
        }
        if (update && !!(Timer.Tac & 0b100)) {
            Timer.Tima++;

            if (Timer.Tima == 0xFF) {
                Timer.Tima = Timer.Tma;
                Interrupt.Request(IntType.Timer);
            }
        }
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return (gbAddress >= DIV_ADDRESS && gbAddress <= TAC_ADDRESS);
    }

    static Store(gbAddress: u16, value: u8): void {
        switch (gbAddress) {
            case DIV_ADDRESS:
                Timer.internalDiv = <u16>0;
                break;
            case TIMA_ADDRESS:
                Timer.Tima = value;
                break;
            case TMA_ADDRESS:
                Timer.Tma = value;
                break;
            case TAC_ADDRESS:
                Timer.Tac = value;
                break;
        }
    }

    static Load(gbAddress: u16): u8 {
        switch (gbAddress) {
            case DIV_ADDRESS:
                return Timer.Div();
            case TIMA_ADDRESS:
                return Timer.Tima;
            case TMA_ADDRESS:
                return Timer.Tma;
            case TAC_ADDRESS:
                return Timer.Tac;
        }
        return 0;
    }
}