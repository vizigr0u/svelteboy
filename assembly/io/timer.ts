import { Interrupt, IntType } from "../cpu/interrupts";
import { Logger } from "../debug/logger";
import { MemoryMap } from "../memory/memoryMap";
import { uToHex } from "../utils/stringUtils";

const DIV_ADDRESS: u16 = 0xFF04;
const TIMA_ADDRESS: u16 = 0xFF05;
const TMA_ADDRESS: u16 = 0xFF06;
const TAC_ADDRESS: u16 = 0xFF07;

function log(s: string): void {
    Logger.Log("TIM: " + s);
}

@final
export class Timer {
    private static readonly InitialDiv: u16 = 0xABCC; // gb: 0xAC00, gbc: 0xABCC; // value found on boot in cgb emu
    private static readonly InitialTac: u8 = 0xF8; // gb: 0, gbc: 0xF8; // value found on boot in cgb emu

    static internalDiv: u16 = Timer.InitialDiv;

    static get Div(): u8 { return <u8>(Timer.internalDiv >> 8); }
    static Tima: u8 = 0;
    static Tma: u8 = 0;
    static Tac: u8 = Timer.InitialTac;

    private static DivWatchBit: u16 = 1 << 9;
    private static Enabled: boolean = false;

    static Init(): void {
        Timer.Tima = 0;
        Timer.Tma = 0;
        Timer.Tac = MemoryMap.useBootRom ? 0x00 : Timer.InitialTac;
        Timer.internalDiv = Timer.InitialDiv;
        Timer.DivWatchBit = Timer.getDivWatchBit(Timer.Tac);
        Timer.Enabled = false;
    }

    static Tick(tCycles: u8 = 4): void {
        if (Logger.verbose >= 2) {
            log('Timer running 1 m-cycle')
        }
        let prevDiv = Timer.internalDiv;
        Timer.internalDiv += tCycles;
        if (Timer.Enabled && (prevDiv & Timer.DivWatchBit) != 0 && (Timer.internalDiv & Timer.DivWatchBit) == 0) {
            if (Logger.verbose >= 2) {
                log(`Timer enabled, relevant bit was reset: ${Timer.DivWatchBit.toString(2)} in ${uToHex<u16>(Timer.internalDiv)}. Tima = ${uToHex<u8>(Timer.Tima)}`)
            }
            if (Timer.Tima == 0xFF) {
                Timer.Tima = Timer.Tma;
                Interrupt.Request(IntType.Timer);
                if (Logger.verbose >= 2) {
                    log(`Requested Int Timer and set Tima to ${uToHex<u8>(Timer.Tma)}`)
                }
            } else {
                Timer.Tima++;
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
                if (Logger.verbose >= 2) {
                    log(`DIV reset`)
                }
                Timer.internalDiv = 0; // take into account LDH op
                break;
            case TIMA_ADDRESS:
                Timer.Tima = value;
                if (Logger.verbose >= 2) {
                    log(`TIMA set to ${uToHex<u8>(value)}`)
                }
                break;
            case TMA_ADDRESS:
                Timer.Tma = value;
                if (Logger.verbose >= 2) {
                    log(`TMA set to ${uToHex<u8>(value)}`)
                }
                break;
            case TAC_ADDRESS:
                Timer.Tac = (Timer.Tac & 0b11111000) | (value & 0b111);
                Timer.Enabled = (value & 0b100) != 0;
                Timer.DivWatchBit = Timer.getDivWatchBit(value);
                if (Logger.verbose >= 2) {
                    log(`TAC set to ${uToHex<u8>(Timer.Tac)}: Timer enabled: ${Timer.Enabled}, bit mask: ${Timer.DivWatchBit}`)
                }
                break;
        }
    }

    static Load(gbAddress: u16): u8 {
        switch (gbAddress) {
            case DIV_ADDRESS:
                return Timer.Div + 8; // take into account LDH op
            case TIMA_ADDRESS:
                return Timer.Tima;
            case TMA_ADDRESS:
                return Timer.Tma;
            case TAC_ADDRESS:
                return Timer.Tac;
        }
        return 0;
    }

    private static getDivWatchBit(tac: u8): u16 {
        switch (tac & 0b11) {
            case 0b00:
                return 1 << 9; // 4 kHz
            case 0b01:
                return 1 << 3; // 256 kHz
            case 0b10:
                return 1 << 5; // 64 kHz
            case 0b11:
                return 1 << 7; // 16 kHz
            default:
                unreachable();
                return 0;
        }
    }
}
