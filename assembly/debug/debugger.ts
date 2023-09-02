import { MemoryMap } from "../cpu/memoryMap";
import { Emulator } from "../emulator";
import { PpuMode } from "../io/video/ppu";
import { Logger } from "./logger";

function log(s: string): void {
    Logger.Log("DBG: " + s);
}

@final
export class Debugger {
    static attached: boolean = false;

    private static _breakpoints: Set<u16> = new Set<u16>();
    private static _pPuModeBreaks: StaticArray<boolean> = new StaticArray<boolean>(4);

    @inline static get breakpoints(): Set<u16> { return Debugger._breakpoints; }
    @inline static get PPuModeBreaks(): StaticArray<boolean> { return Debugger._pPuModeBreaks; }

    static Init(): void {
        this.attached = false;
    }

    static Step(): void {
        Emulator.Tick();
    }

    static SetBreakpoint(address: u16, enabled: boolean = true): void {
        if (enabled && !Debugger.breakpoints.has(address)) {
            Debugger.breakpoints.add(address);
        } else if (!enabled && Debugger.breakpoints.has(address)) {
            Debugger.breakpoints.delete(address);
        }
    }
}

export function attachDebugger(): void {
    Debugger.attached = true;
}

export function detachDebugger(): void {
    Debugger.attached = false;
}

export function debugStep(): void {
    Debugger.Step();
}

export function debugSetPPUBreak(mode: PpuMode, enabled: boolean = true): void {
    if (Logger.verbose >= 1)
        log('Debug PPU break ' + mode.toString() + ': ' + (enabled ? 'ON' : 'OFF'))
    Debugger.PPuModeBreaks[<i32>mode] = enabled;
}

export function debugSetBreakpoint(address: u16, enabled: boolean = true): void {
    Debugger.SetBreakpoint(address, enabled);
}

export function debugHasBreakpoint(address: u16): boolean {
    return !!Debugger.breakpoints.has(address);
}

export function getActiveBreakpoints(): u16[] {
    return Debugger.breakpoints.values();
}
