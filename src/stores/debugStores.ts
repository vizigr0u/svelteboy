import { writable, type Writable } from "svelte/store";
import { DebugStopReason, type DisassembledCode, type GbDebugInfo, type ProgramLine, type RomReference } from "../types";
import { GameFrames } from "./playStores";
import { MakeLocalStore } from "./localStorageStore";

export const disassembledRomsStore = writable<DisassembledCode[]>([]);

export const DebugFrames = writable<number>(0);

export function setDisassemlyForRom(rom: RomReference, isLoading: boolean, programLines: ProgramLine[]) {
    disassembledRomsStore.update(roms => {
        roms[rom.romType].isLoading = isLoading;
        roms[rom.romType].programLines = programLines;
        return roms;
    });
}

export const Verbose = MakeLocalStore<number>("DebugVerbose", 1);
export const Breakpoints = writable<Set<number>>(new Set<number>());
export const DebugSessionStarted = writable<boolean>(false);
export const ProgramRunning = writable<boolean>(false);
export const LastStopReason = writable<DebugStopReason>(DebugStopReason.None);

export const MutedCategories = MakeLocalStore<string[]>("DebugLogMutedCategories", []);

export const GbDebugInfoStore = writable<GbDebugInfo>(undefined);

export const DebugLines = writable<Array<string>>(new Array<string>());

export function appendLog(newLines: string[]): void {
    DebugLines.update((lines) => {
        lines.push(...newLines);
        return lines;
    });
}

GbDebugInfoStore.subscribe(info => {
    GameFrames.set(info?.currentFrame ?? -1)
})