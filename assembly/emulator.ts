import { Cpu } from "./cpu/cpu";
import { IO } from "./io/io";
import { Logger } from "./debug/logger";
import { MemoryMap } from "./memory/memoryMap";
import { Timer } from "./io/timer";
import { Dma } from "./io/video/dma";
import { Ppu, PpuMode } from "./io/video/ppu";
import { Debugger } from "./debug/debugger";
import { SaveGame } from "./memory/savegame";
import { AudioRender } from "./audio/render";
import { CYCLES_PER_SECOND, CYCLES_PER_FRAME } from './constants';
import { APU } from "./audio/apu";
import { Cartridge } from "./cartridge";
import { CGBMode } from "./metadata";
import { CgbState } from "./cgbState";

function log(s: string): void {
    Logger.Log("EMU: " + s);
}

function logCpuTick(t_cycles: u8): void {
    log("Cpu tick lasted " + t_cycles.toString() + ' cycles');
}

enum EmulatorStopReason {
    None = 0,
    HitBreakpoint = 1,
    HitBreakMode = 2,
    CpuStop = 3,
    EndOfFrame = 4,
    UserPause = 5,
    TargetCyclesReached = 6,
}

@final export class Emulator {
    static wasInit: boolean = false;

    private static lastPPUMode: PpuMode;
    private static targetFrame: u32;
    private static targetCycles: u64;

    static Init(useBootRom: boolean = true): void {
        CgbState.setIsCGB(Cartridge.Data.getCGBMode() != CGBMode.NonCGB);
        CgbState.setDoubleSpeed(false);
        CgbState.setKey1(0);
        CgbState.masterCycleCount = 0;
        SaveGame.Init();
        Logger.Init()
        MemoryMap.Init(MemoryMap.loadedBootRomSize > 0 && useBootRom);
        IO.Init();
        Ppu.Init();
        Cpu.Init(MemoryMap.loadedBootRomSize > 0 && useBootRom);
        APU.Init();
        AudioRender.Init();
        Emulator.targetCycles = 0;
        Emulator.targetFrame = 0;
        Emulator.wasInit = true;
    }

    static Tick(): void {
        if (Logger.verbose >= 3)
            log("Ticking emulator");

        const t_cycles = Cpu.Tick();

        if (Logger.verbose >= 4)
            logCpuTick(t_cycles);

        const masterCycles: u8 = t_cycles >> CgbState.doubleSpeedShift;
        CgbState.masterCycleCount += masterCycles;

        // Timer/DIV and OAM DMA are clocked by CPU T-cycles (doubled in CGB double-speed).
        // PPU and APU track wall-clock time via master cycles (unchanged by speed switch).
        Timer.Tick(t_cycles);

        Ppu.TickMultiple(masterCycles);
        if (Dma.active) {
            for (let m: u8 = 0, n: u8 = t_cycles >> 2; m < n; m++)
                Dma.Tick();
        }

        if (Cpu.stopDivResetPending) {
            // STOP resets DIV after subsystem ticks (spec: reset applies at the instant of STOP).
            Timer.internalDiv = 0;
            Cpu.stopDivResetPending = false;
        }
    }

    static EndlessLoop(): void {
        while (!Cpu.isStopped) {
            Emulator.Tick();
        }
    }

    static Run(timeMilliSec: f64): EmulatorStopReason {
        const maxCycles: u64 = <u64>Math.round((timeMilliSec * CYCLES_PER_SECOND) / 1000);

        Emulator.targetCycles = CgbState.masterCycleCount + maxCycles;
        Emulator.targetFrame = 0;
        AudioRender.Prepare(CgbState.masterCycleCount);
        let stopReason = EmulatorStopReason.None;
        do {
            Emulator.lastPPUMode = Ppu.currentMode;
            Emulator.Tick();
            stopReason = Emulator.GetStopReason();
        } while (stopReason == EmulatorStopReason.None);
        AudioRender.Render(CgbState.masterCycleCount);
        return stopReason;
    }

    static RunFrames(frames: u32): EmulatorStopReason {
        Emulator.targetFrame = Ppu.currentFrame + frames;
        // Safety cap: prevent infinite loop when LCD is off (Ppu.currentFrame never increments).
        // Must exceed one real hardware frame (154 scanlines × 456 dots = 70224 cycles) so
        // that EndOfFrame still fires first under normal operation.
        Emulator.targetCycles = CgbState.masterCycleCount + <u64>CYCLES_PER_FRAME * (<u64>frames + 1);
        let lastFrame: u32 = Ppu.currentFrame;
        AudioRender.Prepare(CgbState.masterCycleCount);
        let stopReason = EmulatorStopReason.None;
        do {
            Emulator.lastPPUMode = Ppu.currentMode;
            Emulator.Tick();
            if (Ppu.currentFrame != lastFrame) {
                AudioRender.Render(CgbState.masterCycleCount);
                AudioRender.outBuffer.markBuffersRead(AudioRender.outBuffer.getBuffersToReadCount());
                AudioRender.Prepare(CgbState.masterCycleCount);
                lastFrame = Ppu.currentFrame;
            }
            stopReason = Emulator.GetStopReason();
        } while (stopReason == EmulatorStopReason.None);
        AudioRender.Render(CgbState.masterCycleCount);
        return stopReason;
    }

    @inline static GetStopReason(): EmulatorStopReason {
        if (Emulator.targetCycles != 0 && CgbState.masterCycleCount >= Emulator.targetCycles) {
            if (Logger.verbose >= 2)
                log('Emulator stopped: Target cycles reached')
            return EmulatorStopReason.TargetCyclesReached;
        }
        if (Cpu.isStopped) {
            if (Logger.verbose >= 2)
                log('Emulator stopped: Cpu was Stopped')
            return EmulatorStopReason.CpuStop;
        }
        if (Debugger.attached) {
            if (Debugger.breakpoints.has(Cpu.ProgramCounter)) {
                if (Logger.verbose >= 2)
                    log('Emulator stopped: Debugger Hit a Breakpoint')
                return EmulatorStopReason.HitBreakpoint;
            }
            if (Ppu.currentMode != Emulator.lastPPUMode && Debugger.PPuModeBreaks[Ppu.currentMode]) {
                if (Logger.verbose >= 2)
                    log('Emulator stopped: HitBreakMode')
                return EmulatorStopReason.HitBreakMode;
            }
        }
        if (Emulator.targetFrame != 0 && Ppu.currentFrame == Emulator.targetFrame) {
            if (Logger.verbose >= 2)
                log('Emulator stopped: End of frame')
            return EmulatorStopReason.EndOfFrame;
        }
        return EmulatorStopReason.None;
    }
}

export function initEmulator(useBootRom: boolean = true): void { Emulator.Init(useBootRom); }

export function runFrames(frames: u32): EmulatorStopReason { return Emulator.RunFrames(frames); }

export function runOneFrame(): EmulatorStopReason { return Emulator.RunFrames(1); }

export function runEmulator(timeMilliSec: f64): EmulatorStopReason { return Emulator.Run(timeMilliSec); }

export function emulatorEndlessLoop(): void { Emulator.EndlessLoop(); }
