import { Cpu } from "../cpu/cpu";
import { Interrupt } from "../cpu/interrupts";
import { MemoryMap } from "../memory/memoryMap";
import { Serial } from "../io/serial";
import { Timer } from "../io/timer";
import { Lcd } from "../io/video/lcd";
import { Ppu, PpuOamFifo } from "../io/video/ppu";
import { ProgramLine, getDisassemble } from "./disassemble";

export class DebugInfo {
    registers: DebugRegisterInfo;
    lcd: LcdInfo;
    timer: TimerInfo;
    ppu: PpuInfo;
    currentFrame: u32;
    useBootRom: boolean;
    isHalted: boolean;
    isStopped: boolean;
    cycleCount: u32;
    interruptsMaster: boolean;
    interruptFlags: u8;
    interruptEnabled: u8;
    serialBuffer: string;
    nextInstruction: ProgramLine
}

class DebugRegisterInfo {
    AF: u16;
    BC: u16;
    DE: u16;
    HL: u16;
    PC: u16;
    SP: u16;
}

class LcdInfo {
    control: u8;
    stat: u8;
    scY: u8;
    scX: u8;
    lY: u8;
    lYcompare: u8;
    dma: u8;
}

class TimerInfo {
    div: u8;
    tima: u8;
    tma: u8;
    tac: u8;
    internalDiv: u16;
}

class PpuInfo {
    currentDot: u16;
    currentMode: u8;
    lineSpritesIndices: Array<u8>;
}

export function getDebugInfo(): DebugInfo {
    return {
        registers: {
            AF: Cpu.AF,
            BC: Cpu.BC,
            DE: Cpu.DE,
            HL: Cpu.HL,
            PC: Cpu.ProgramCounter,
            SP: Cpu.StackPointer,
        },
        lcd: {
            control: Lcd.data.control,
            stat: Lcd.data.stat,
            scY: Lcd.data.scrollY,
            scX: Lcd.data.scrollX,
            lY: Lcd.data.lY,
            lYcompare: Lcd.data.lYcompare,
            dma: Lcd.data.dma,
        },
        timer: {
            div: Timer.Div,
            tima: Timer.Tima,
            tma: Timer.Tma,
            tac: Timer.Tac,
            internalDiv: Timer.internalDiv
        },
        ppu: {
            currentDot: Ppu.currentDot,
            currentMode: <u8>Ppu.currentMode,
            lineSpritesIndices: PpuOamFifo.buffer.slice(PpuOamFifo.head, PpuOamFifo.size)

        },
        currentFrame: Ppu.currentFrame,
        useBootRom: MemoryMap.useBootRom,
        isHalted: Cpu.isHalted,
        isStopped: Cpu.isStopped,
        cycleCount: Cpu.CycleCount,
        interruptsMaster: Interrupt.masterEnabled,
        interruptFlags: Interrupt.Requests(),
        interruptEnabled: Interrupt.GetEnabled(),
        serialBuffer: Serial.message,
        nextInstruction: getDisassemble(Cpu.ProgramCounter)
    }
}
