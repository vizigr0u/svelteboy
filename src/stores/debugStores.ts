import { derived, writable } from "svelte/store";
import type { DisassembledCode, GbDebugInfo, ProgramLine, RomReference } from "../types";
import { loadedCartridge } from "./romStores";

export const disassembledRomsStore = writable<DisassembledCode[]>([]);

export function setDisassemlyForRom(rom: RomReference, isLoading: boolean, programLines: ProgramLine[]) {
    disassembledRomsStore.update(roms => {
        roms[rom.romType].isLoading = isLoading;
        roms[rom.romType].programLines = programLines;
        return roms;
    });
}

export const Breakpoints = writable<Set<number>>(new Set<number>());
export const DebugSessionStarted = writable<boolean>(false);
export const ProgramRunning = writable<boolean>(false);

export const GbDebugInfoStore = writable<GbDebugInfo>(undefined);

export const DebugLines = writable<Array<string>>(new Array<string>());

export function appendLog(newLines: string[]): void {
    DebugLines.update((lines) => {
        lines.push(...newLines);
        return lines;
    });
}
