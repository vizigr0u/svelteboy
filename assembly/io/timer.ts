import { Interrupt, IntType } from "../cpu/interrupts";
import { MemoryMap } from "../memory/memoryMap";

const DIV_ADDRESS: u16 = 0xFF04;
const TIMA_ADDRESS: u16 = 0xFF05;
const TMA_ADDRESS: u16 = 0xFF06;
const TAC_ADDRESS: u16 = 0xFF07;

@final
export class Timer {
    private static readonly InitialDiv: u16 = 0xAC00; // gb: 0xAC00, gbc: 0xABCC; // value found on boot in cgb emu
    private static readonly InitialTac: u8 = 0; // gb: 0, gbc: 0xF8; // value found on boot in cgb emu

    static internalDiv: u16 = Timer.InitialDiv;

    static get Div(): u8 { return <u8>(Timer.internalDiv >> 8); }
    static Tima: u8 = 0;
    static Tma: u8 = 0;
    static Tac: u8 = Timer.InitialTac;

    private static DivResetMask: u16 = 1 << 9;
    private static Enabled: boolean = false;

    static Init(): void {
        Timer.internalDiv = Timer.InitialDiv;
        Timer.Tima = 0;
        Timer.Tma = 0;
        Timer.Tac = MemoryMap.useBootRom ? 0x00 : Timer.InitialTac;
    }

    static Tick(): void {
        Timer.internalDiv++;

        if (Timer.Enabled && (Timer.internalDiv & Timer.DivResetMask) == 0) {
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
                Timer.Enabled = (value & 0b100) != 0;
                Timer.DivResetMask = Timer.getDivResetMask(value);
                break;
        }
    }

    static Load(gbAddress: u16): u8 {
        switch (gbAddress) {
            case DIV_ADDRESS:
                return Timer.Div;
            case TIMA_ADDRESS:
                return Timer.Tima;
            case TMA_ADDRESS:
                return Timer.Tma;
            case TAC_ADDRESS:
                return Timer.Tac;
        }
        return 0;
    }

    private static getDivResetMask(tac: u8): u16 {
        switch (tac & 0b11) {
            case 0b00:
                return 0b11111111;
            case 0b01:
                return 0b00000011;
            case 0b10:
                return 0b00001111;
            case 0b11:
                return 0b00111111;
            default:
                unreachable();
                return 0;
        }
    }
}