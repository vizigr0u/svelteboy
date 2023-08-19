import { RomType, type ProgramLine, type RomReference, MemoryRegion } from "./types";

import { appendLog, disassembledRomsStore, setDisassemlyForRom } from "./stores/debugStores";
import { getBootLines, getCartLines, hexDump, runOneFrame, init, setVerbose, spliceLogs } from "../build/release";

function getLines(
    rom: RomReference,
    fromPC: number,
    toPC: number
): Promise<Array<ProgramLine>> {
    return new Promise<Array<ProgramLine>>((resolve) => {
        resolve(
            rom.romType == RomType.Boot
                ? getBootLines(fromPC, toPC)
                : getCartLines(fromPC, toPC)
        );
    });
}

export function getHexDump(fromPC: number, toPC: number): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve) => resolve(hexDump(fromPC, toPC)));
}

export function measureCpuFrames(numFrames: number, maxCyclesPerFrame: number): Promise<number> {
    return new Promise<number>((resolve) => {
        init();
        setVerbose(0);
        const t0 = performance.now();
        for (let i = 0; i < numFrames; i++) {
            runOneFrame(maxCyclesPerFrame);
        }
        const t1 = performance.now();
        return resolve(t1 - t0);
    });
}

function getMemoryBounds(romType: RomType, region: MemoryRegion): number[] {
    if (romType == RomType.Boot)
        return [0, 0x9FF];
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
    console.log("Started fetching");
    const bounds = getMemoryBounds(rom.romType, region);
    let pc = bounds[0];
    const maxPC = bounds[1];
    disassembledRomsStore.update(roms => {
        roms[rom.romType] = { ...rom, region, isLoading: true, programLines: [] };
        return roms;
    });

    while (pc <= maxPC) {
        const oldPc = pc;
        const thisMaxPC = maxPC - pc > 0x2000 ? pc + 0x2000 : maxPC;
        // await is converting Promise<number> into number
        const lines: Array<ProgramLine> = await getLines(rom, pc, thisMaxPC);
        disassembledRomsStore.update(roms => {
            roms[rom.romType].programLines = roms[rom.romType].programLines.concat(lines);
            return roms;
        });
        pc = lines.at(-1).pc + lines.at(-1).byteSize;
        console.log(
            `fetched ${lines.length} lines of  $${oldPc.toString(
                16
            )}->$${pc.toString(16)}`
        );
    }

    disassembledRomsStore.update(roms => {
        roms[rom.romType].isLoading = false;
        return roms;
    });
    console.log("Done fetching ");
}

// async function always returns a Promise
export async function fetchLogs(): Promise<void> {
    const maxLinePerFetch = 1000;
    let linesFetched: number = 0;
    do {
        const lines = await new Promise<string[]>(r => r(spliceLogs(maxLinePerFetch)));
        linesFetched = lines.length;
        await new Promise<void>(r => { appendLog(lines); r() });;
    } while (linesFetched == maxLinePerFetch);
}
