import { Cpu } from "./cpu";
import { Interrupt } from "./interrupts";
import { IO } from "./io";
import { Logger } from "./logger";
import { MemoryMap } from "./memoryMap";
import { Ppu } from "./video/ppu";

const OFFICIAL_CYCLES_PER_SECOND: u32 = 4194304;
const CYCLES_PER_SECOND: u32 = 4194162; // measured on real GBs in a small survey

const FPS: u32 = 60;
const CYCLES_PER_FRAME: u32 = CYCLES_PER_SECOND / FPS;

@final export class Emulator {
    static Init(useBootRom: boolean = true): void {
        Logger.Init();
        Cpu.init(useBootRom);
        Interrupt.Init();
        MemoryMap.Init(useBootRom);
        IO.Init();
        Ppu.Init();
    }

    static Loop(): void {
        while (!Cpu.isStopped) {
            Cpu.Tick();
        }
    }

    // static runOneFrame(maxCycles: u32 = CYCLES_PER_FRAME): void {
    static RunOneFrame(maxCycles: u32 = CYCLES_PER_FRAME): void {
        if (u32.MAX_VALUE - Cpu.CycleCount <= (maxCycles << 1))
            Cpu.CycleCount = 0;
        maxCycles += Cpu.CycleCount;
        while (Cpu.CycleCount < maxCycles) {
            Cpu.Tick();
        }
    }
}