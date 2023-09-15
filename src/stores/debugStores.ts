import { writable } from "svelte/store";
import { DebugStopReason, MemoryRegion, type DisassembledCode, type GbDebugInfo, type ProgramLine, type RomReference } from "../types";
import { MakeLocalStore } from "./localStorageStore";

export const disassembledRomsStore = writable<DisassembledCode>(undefined);

export function setDisassemlyForRom(rom: RomReference, isLoading: boolean, programLines: ProgramLine[]) {
    disassembledRomsStore.update(roms => {
        roms.isLoading = isLoading;
        roms.programLines = programLines;
        return roms;
    });
}

export const Verbose = writable<number>(1);
export const DebuggerAttached = writable<boolean>(false);
export const Breakpoints = writable<Set<number>>(new Set<number>());
export const LastStopReason = writable<DebugStopReason>(DebugStopReason.None);
export const AudioAnalyzerNode = writable<AnalyserNode>(undefined);

export const MutedCategories = MakeLocalStore<string[]>("DebugLogMutedCategories", []);

export const GbDebugInfoStore = writable<GbDebugInfo>(undefined);

export const DebugLines = writable<Array<string>>(new Array<string>());

export function appendLog(newLines: string[]): void {
    DebugLines.update((lines) => {
        lines.push(...newLines);
        return lines;
    });
}
