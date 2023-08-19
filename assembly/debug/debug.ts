import { Cpu } from "../cpu/cpu";
import { ProgramLine, getDisassemble } from "../debug/disassemble";
import { Emulator } from "../emulator";
import { Interrupt } from "../cpu/interrupts";
import { MemoryMap } from "../cpu/memoryMap";
import { Serial } from "../io/serial";
import { Timer } from "../io/timer";
import { Lcd } from "../io/video/lcd";
import { Ppu } from "../io/video/ppu";


export const breakpoints: Set<u16> = new Set<u16>();

export class DebugInfo {
    registers: DebugRegisterInfo;
    lcd: LcdInfo;
    timer: TimerInfo;
    ppu: PpuInfo;
    debug: DebugStatusInfo;
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
}

class DebugStatusInfo {
    paused: boolean;
    stoppedByBreakpoint: boolean;
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
            scY: Lcd.gbData().scrollY,
            scX: Lcd.gbData().scrollX,
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
        ppu: {
            currentDot: Ppu.currentDot,
            currentMode: <u8>Ppu.currentMode
        },
        debug: {
            paused: Debug.isPaused,
            stoppedByBreakpoint: !!breakpoints.has(Cpu.ProgramCounter)
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

@final
export class Debug {
    static isPaused: boolean = false;
    static disableLcdForTests: boolean = false;

    static Init(): void {
        this.isPaused = false;
    }

    static RunOneFrame(): void {
        Debug.isPaused = false;
        const initialFrame = Ppu.currentFrame;
        do {
            Emulator.Tick();
        } while (Ppu.currentFrame == initialFrame
        && !Debug.isPaused
        && !Cpu.isStopped
            && !breakpoints.has(Cpu.ProgramCounter));
    }

    static Step(): void {
        Emulator.Tick();
    }

    static SetBreakpoint(address: u16, enabled: boolean = true): void {
        if (enabled && !breakpoints.has(address)) {
            breakpoints.add(address);
        } else if (!enabled && breakpoints.has(address)) {
            breakpoints.delete(address);
        }
    }
}

export function debugRunFrame(): void {
    Debug.RunOneFrame();
}

export function debugStep(): void {
    Debug.Step();
}

export function debugPause(paused: boolean = true): void {
    Debug.isPaused = paused;
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
