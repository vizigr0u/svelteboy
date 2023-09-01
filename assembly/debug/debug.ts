import { Cpu } from "../cpu/cpu";
import { ProgramLine, getDisassemble } from "../debug/disassemble";
import { Emulator } from "../emulator";
import { Interrupt } from "../cpu/interrupts";
import { MemoryMap } from "../cpu/memoryMap";
import { Serial } from "../io/serial";
import { Timer } from "../io/timer";
import { Lcd } from "../io/video/lcd";
import { Ppu, PpuMode, PpuOamFifo } from "../io/video/ppu";
import { Logger } from "./logger";


const breakpoints: Set<u16> = new Set<u16>();
const PPuModeBreaks: StaticArray<boolean> = new StaticArray<boolean>(4);

function log(s: string): void {
    Logger.Log("DBG: " + s);
}

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
    lineSpritesIndices: Array<u8>;
}

class DebugStatusInfo {
    paused: boolean;
    stoppedByBreakpoint: boolean;
}

enum DebugStopReason {
    None = 0,
    HitBreakpoint = 1,
    HitBreakMode = 2,
    CpuStop = 3,
    EndOfFrame = 4,
    UserPause = 5
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
            control: Lcd.data.control,
            stat: Lcd.data.stat,
            scY: Lcd.data.scrollY,
            scX: Lcd.data.scrollX,
            lY: Lcd.data.lY,
            lYcompare: Lcd.data.lYcompare,
            dma: Lcd.data.dma,
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
            currentMode: <u8>Ppu.currentMode,
            lineSpritesIndices: PpuOamFifo.buffer.slice(PpuOamFifo.head, PpuOamFifo.size)

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

    private static startFrame: u32;
    private static prevMode: PpuMode;

    static Init(): void {
        this.isPaused = false;
    }

    private static GetStopReason(): DebugStopReason {
        if (Debug.isPaused) {
            if (Logger.verbose >= 2)
                log('Debug stopped: UserPause')
            return DebugStopReason.UserPause;
        }
        if (Cpu.isStopped) {
            if (Logger.verbose >= 2)
                log('Debug stopped: CpuStop')
            return DebugStopReason.CpuStop;
        }
        if (Ppu.currentFrame != Debug.startFrame) {
            if (Logger.verbose >= 2)
                log('Debug stopped: EndOfFrame')
            return DebugStopReason.EndOfFrame;
        }
        if (breakpoints.has(Cpu.ProgramCounter)) {
            if (Logger.verbose >= 2)
                log('Debug stopped: HitBreakpoint')
            return DebugStopReason.HitBreakpoint;
        }
        if (Ppu.currentMode != Debug.prevMode && PPuModeBreaks[Ppu.currentMode]) {
            if (Logger.verbose >= 2)
                log('Debug stopped: HitBreakMode')
            return DebugStopReason.HitBreakMode;
        }
        return DebugStopReason.None;
    }

    static RunOneFrame(): DebugStopReason {
        Debug.isPaused = false;
        Debug.startFrame = Ppu.currentFrame;
        let stopReason = DebugStopReason.None;
        do {
            Debug.prevMode = Ppu.currentMode;
            Emulator.Tick();
            stopReason = Debug.GetStopReason()
        } while (stopReason == DebugStopReason.None);
        return stopReason;
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

export function debugRunFrame(): DebugStopReason {
    return Debug.RunOneFrame();
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

export function debugSetPPUBreak(mode: PpuMode, enabled: boolean = true): void {
    if (Logger.verbose >= 1)
        log('Debug PPU break ' + mode.toString() + ': ' + (enabled ? 'ON' : 'OFF'))
    PPuModeBreaks[<i32>mode] = enabled;
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
