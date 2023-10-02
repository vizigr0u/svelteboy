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
import { CYCLES_PER_SECOND } from './constants';
import { APU } from "./audio/apu";

function log(s: string): void {
    Logger.Log("EMU: " + s);
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

        Timer.Tick(4);
        const t_cycles = Cpu.Tick();

        if (Logger.verbose >= 4)
            log("Cpu tick lasted " + t_cycles.toString() + ' cycles');

        if (t_cycles > 4)
            Timer.Tick(t_cycles - 4);
        for (let i: u8 = 0; i < t_cycles; i++) {
            Ppu.Tick();
            if (Dma.active && i % 4 == 0)
                Dma.Tick();
        }
    }

    static EndlessLoop(): void {
        while (!Cpu.isStopped) {
            Emulator.Tick();
        }
    }

    static Run(timeMilliSec: f64): EmulatorStopReason {
        const maxCycles: u64 = <u64>Math.round((timeMilliSec * CYCLES_PER_SECOND) / 1000);

        Emulator.targetCycles = Cpu.CycleCount + maxCycles;
        Emulator.targetFrame = 0;
        AudioRender.Prepare(Cpu.CycleCount);
        let stopReason = EmulatorStopReason.None;
        do {
            Emulator.lastPPUMode = Ppu.currentMode;
            Emulator.Tick();
            stopReason = Emulator.GetStopReason();
        } while (stopReason == EmulatorStopReason.None);
        AudioRender.Render(Cpu.CycleCount);
        return stopReason;
    }

    static RunOneFrame(): EmulatorStopReason {
        Emulator.targetFrame = Ppu.currentFrame + 1;
        Emulator.targetCycles = 0;
        AudioRender.Prepare(Cpu.CycleCount);
        let stopReason = EmulatorStopReason.None;
        do {
            Emulator.lastPPUMode = Ppu.currentMode;
            Emulator.Tick();
            stopReason = Emulator.GetStopReason();
        } while (stopReason == EmulatorStopReason.None);
        AudioRender.Render(Cpu.CycleCount);
        return stopReason;
    }

    static GetStopReason(): EmulatorStopReason {
        if (Emulator.targetCycles != 0 && Cpu.CycleCount >= Emulator.targetCycles) {
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

export function runOneFrame(): EmulatorStopReason { return Emulator.RunOneFrame(); }

export function runEmulator(timeMilliSec: f64): EmulatorStopReason { return Emulator.Run(timeMilliSec); }

export function emulatorEndlessLoop(): void { Emulator.EndlessLoop(); }
