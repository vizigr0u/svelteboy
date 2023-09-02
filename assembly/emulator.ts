import { Cpu } from "./cpu/cpu";
import { IO } from "./io/io";
import { Logger } from "./debug/logger";
import { MemoryMap } from "./memory/memoryMap";
import { Timer } from "./io/timer";
import { Dma } from "./io/video/dma";
import { Ppu, PpuMode } from "./io/video/ppu";
import { Debugger } from "./debug/debugger";

const OFFICIAL_CYCLES_PER_SECOND: u32 = 4194304;
const CYCLES_PER_SECOND: u32 = 4194162; // measured on real GBs in a small survey

const FPS: u32 = 60;
const CYCLES_PER_FRAME: u32 = CYCLES_PER_SECOND / FPS;

function log(s: string): void {
    Logger.Log("EMU: " + s);
}

enum EmulatorStopReason {
    None = 0,
    HitBreakpoint = 1,
    HitBreakMode = 2,
    CpuStop = 3,
    EndOfFrame = 4,
    UserPause = 5
}

@final export class Emulator {
    static wasInit: boolean = false;

    private static lastPPUMode: PpuMode;
    private static startFrame: u32;

    static Init(useBootRom: boolean = true): void {
        Logger.Init()
        MemoryMap.Init(MemoryMap.loadedBootRomSize > 0 && useBootRom);
        IO.Init();
        Ppu.Init();
        Cpu.Init(MemoryMap.loadedBootRomSize > 0 && useBootRom);
        Emulator.wasInit = true;
    }

    static Tick(): void {
        if (Logger.verbose >= 3)
            log("Ticking emulator");

        const t_cycles = Cpu.Tick();

        if (Logger.verbose >= 4)
            log("Cpu tick lasted " + t_cycles.toString() + ' cycles');

        for (let i: u8 = 0; i < t_cycles; i++) {
            Timer.Tick();
            Ppu.Tick();
            if (i % 4 == 0)
                Dma.Tick();
        }
    }

    static EndlessLoop(): void {
        while (!Cpu.isStopped) {
            Emulator.Tick();
        }
    }

    static RunOneFrame(): EmulatorStopReason {
        Emulator.startFrame = Ppu.currentFrame;
        let stopReason = EmulatorStopReason.None;
        do {
            Emulator.lastPPUMode = Ppu.currentMode;
            Emulator.Tick();
            stopReason = Emulator.GetStopReason();
        } while (stopReason == EmulatorStopReason.None)
        return stopReason;
    }

    static GetStopReason(): EmulatorStopReason {
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
        if (Ppu.currentFrame != Emulator.startFrame) {
            if (Logger.verbose >= 2)
                log('Emulator stopped: End of frame')
            return EmulatorStopReason.EndOfFrame;
        }
        return EmulatorStopReason.None;
    }
}

export function initEmulator(useBootRom: boolean = true): void { Emulator.Init(useBootRom); }

export function runOneFrame(): EmulatorStopReason { return Emulator.RunOneFrame(); }

export function emulatorEndlessLoop(): void { Emulator.EndlessLoop(); }
