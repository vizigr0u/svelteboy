import { Cpu } from "./cpu";
import { ProgramLine, getDisassemble } from "./disassemble";
import { Interrupt } from "./interrupts";
import { MemoryMap } from "./memoryMap";
import { Serial } from "./serial";
import { Timer } from "./timer";
import { Lcd } from "./video/lcd";


export const breakpoints: Set<u16> = new Set<u16>();

export class DebugInfo {
    registers: DebugRegisterInfo;
    lcd: LcdInfo;
    timer: TimerInfo;
    useBootRom: boolean;
    isPaused: boolean;
    stoppedByBreakpoint: boolean;
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

export function makeDebugInfo(): DebugInfo {
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
            control: Lcd.gbData().control,
            stat: Lcd.gbData().stat,
            scY: Lcd.gbData().scY,
            scX: Lcd.gbData().scX,
            lY: Lcd.gbData().lY,
            lYcompare: Lcd.gbData().lYcompare,
            dma: Lcd.gbData().dma,
        },
        timer: {
            div: Timer.Div(),
            tima: Timer.Tima,
            tma: Timer.Tma,
            tac: Timer.Tac,
            internalDiv: Timer.internalDiv
        },
        useBootRom: MemoryMap.useBootRom,
        isPaused: Debug.isPaused,
        stoppedByBreakpoint: !!breakpoints.has(Cpu.ProgramCounter),
        cycleCount: Cpu.CycleCount,
        interruptsMaster: Interrupt.masterEnabled,
        interruptFlags: Interrupt.Requests(),
        interruptEnabled: Interrupt.GetEnabled(),
        serialBuffer: Serial.message,
        nextInstruction: getDisassemble(Cpu.ProgramCounter)
    }
}

@final
export class Debug {
    static isPaused: boolean = false;
    static disableLcdForTests: boolean = false;

    static RunFrame(maxCycles: u32): void {
        if (u32.MAX_VALUE - Cpu.CycleCount <= (maxCycles << 1))
            Cpu.CycleCount = 0;
        maxCycles += Cpu.CycleCount;
        while (Cpu.CycleCount < maxCycles && !breakpoints.has(Cpu.ProgramCounter)) {
            Cpu.Tick();
        }
    }

    static Step(): void {
        Cpu.Tick();
    }

    static SetBreakpoint(address: u16, enabled: boolean = true): void {
        if (enabled && !breakpoints.has(address)) {
            breakpoints.add(address);
        } else if (!enabled && breakpoints.has(address)) {
            breakpoints.delete(address);
        }
    }
}

export function debugRunFrame(maxCycles: u32): void {
    Debug.RunFrame(maxCycles);
}

export function debugStep(): void {
    Debug.Step();
}

export function debugPause(): void {
    Debug.isPaused = true;
}

export function debugGetStatus(): DebugInfo {
    return makeDebugInfo();
}

export function debugSetBreakpoint(address: u16, enabled: boolean = true): void {
    Debug.SetBreakpoint(address, enabled);
}

export function debugHasBreakpoint(address: u16): boolean {
    return !!breakpoints.has(address);
}

export function getActiveBreakpoints(): u16[] {
    return breakpoints.values();
}
