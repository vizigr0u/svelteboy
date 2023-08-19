import { Cpu } from "./cpu/cpu";
import { IO } from "./io/io";
import { Logger, log } from "./debug/logger";
import { MemoryMap } from "./cpu/memoryMap";
import { Timer } from "./io/timer";
import { Dma } from "./io/video/dma";
import { Ppu } from "./io/video/ppu";

const OFFICIAL_CYCLES_PER_SECOND: u32 = 4194304;
const CYCLES_PER_SECOND: u32 = 4194162; // measured on real GBs in a small survey

const FPS: u32 = 60;
const CYCLES_PER_FRAME: u32 = CYCLES_PER_SECOND / FPS;

@final export class Emulator {
    static wasInit: boolean = false;

    static Init(useBootRom: boolean = true): void {
        Logger.Init();
        Cpu.Init(MemoryMap.loadedBootRomSize > 0 && useBootRom);
        MemoryMap.Init(MemoryMap.loadedBootRomSize > 0 && useBootRom);
        IO.Init();
        Ppu.Init();
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

    static Loop(): void {
        while (!Cpu.isStopped) {
            Emulator.Tick();
        }
    }

    static RunOneFrame(): void {
        const initialFrame = Ppu.currentFrame;
        do {
            Emulator.Tick();
        } while (Ppu.currentFrame == initialFrame && !Cpu.isStopped)
    }
}
