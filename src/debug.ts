import { type ProgramLine, type RomReference, MemoryRegion } from "./types";

import { get } from "svelte/store";
import { appendLog, disassembledRomsStore } from "stores/debugStores";
import {
    getCartLines,
    hexDump,
    runFrames,
    getAudioBuffersToReadCount,
    markAudioBuffersRead,
    spliceLogs
} from "../build/backend";
import { EmulatorInitialized, EmulatorPaused } from "stores/playStores";
import { Emulator } from "./emulator";

export type BenchmarkResult =
    | { ok: true; frames: number; ms: number; fps: number }
    | { ok: false; error: string };

function getLines(
    rom: RomReference,
    fromPC: number,
    toPC: number
): Promise<Array<ProgramLine>> {
    return new Promise<Array<ProgramLine>>((resolve) => {
        resolve(getCartLines(fromPC, toPC));
    });
}

export function getHexDump(fromPC: number, toPC: number): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve) => resolve(hexDump(fromPC, toPC)));
}

export async function benchmarkFrames(numFrames: number): Promise<BenchmarkResult> {
    if (!get(EmulatorInitialized))
        return { ok: false, error: "No ROM loaded" };
    if (numFrames <= 0)
        return { ok: false, error: "Frame count must be > 0" };

    const wasRunning = !get(EmulatorPaused);
    if (wasRunning) Emulator.Pause();

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const t0 = performance.now();
    runFrames(numFrames);
    const t1 = performance.now();

    const pending = getAudioBuffersToReadCount();
    if (pending > 0) markAudioBuffersRead(pending);

    if (wasRunning) Emulator.RunUntilBreak();

    const ms = t1 - t0;
    const fps = ms > 0 ? (numFrames * 1000) / ms : 0;
    return { ok: true, frames: numFrames, ms, fps };
}

function getMemoryBounds(region: MemoryRegion): number[] {
    switch (region) {
        case MemoryRegion.Rom:
            return [0, 0x7FFF];
        case MemoryRegion.WorkRam:
            return [0xC000, 0xDFFF];
        case MemoryRegion.HighRam:
            return [0xFF80, 0xFFFE];
    }
}

// async function always returns a Promise
export async function fetchDisassembly(rom: RomReference, region: MemoryRegion = MemoryRegion.Rom): Promise<void> {
    // console.log("Started fetching");
    const bounds = getMemoryBounds(region);
    let pc = bounds[0];
    const maxPC = bounds[1];
    disassembledRomsStore.set({
        name: rom.name,
        sha1: rom.sha1,
        region,
        isLoading: true,
        programLines: [],
    });

    while (pc <= maxPC) {
        const oldPc = pc;
        const thisMaxPC = maxPC - pc > 0x2000 ? pc + 0x2000 : maxPC;
        // await is converting Promise<number> into number
        const lines: Array<ProgramLine> = await getLines(rom, pc, thisMaxPC);
        disassembledRomsStore.update(current => {
            if (current)
                current.programLines = current.programLines.concat(lines);
            return current;
        });
        pc = lines.at(-1)!.pc + lines.at(-1)!.byteSize;
    }

    disassembledRomsStore.update(current => {
        if (current)
            current.isLoading = false;
        return current;
    });
    // console.log("Done fetching ");
}

// async function always returns a Promise
export async function fetchLogs(): Promise<void> {
    const maxLinePerFetch = 1000;
    let linesFetched: number = 0;
    do {
        const lines = await new Promise<string[]>(r => r(spliceLogs(maxLinePerFetch)));
        linesFetched = lines.length;
        await new Promise<void>(r => { appendLog(lines); r() });
    } while (linesFetched == maxLinePerFetch);
}
