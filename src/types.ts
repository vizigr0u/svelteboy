export interface ProgramLine {
    pc: number;
    opCode: number;
    byteSize: number;
    cycleCounts: number[];
    prefixed: boolean;
    op: string;
    parameters: string[];
};

export enum RomType {
    Boot = 0,
    Cartridge = 1
}

export interface RomReference {
    filename: string,
    uuid: string,
    romType: RomType
};

export type StoredRom = RomReference & {
    contentBase64: string,
    fileSize: number
};

export enum MemoryRegion {
    Rom,
    WorkRam,
    HighRam
}

export type DisassembledCode = RomReference & {
    programLines: ProgramLine[],
    region: MemoryRegion,
    isLoading: boolean
}

export type GbRegisterInfo = {
    AF: number,
    BC: number,
    DE: number,
    HL: number,
    PC: number,
    SP: number
}

export type LcdInfo = {
    control: number;
    stat: number;
    scY: number;
    scX: number;
    lY: number;
    lYcompare: number;
    dma: number;
}

export type TimerInfo = {
    div: number;
    tima: number;
    tma: number;
    tac: number;
    internalDiv: number;
}

class PpuInfo {
    currentDot: number;
    currentMode: number;
}

export type GbDebugInfo = {
    registers: GbRegisterInfo,
    lcd: LcdInfo,
    timer: TimerInfo,
    ppu: PpuInfo,
    currentFrame: number,
    useBootRom: boolean,
    isPaused: boolean,
    stoppedByBreakpoint: boolean,
    cycleCount: number,
    interruptsMaster: boolean,
    interruptFlags: number,
    interruptEnabled: number,
    serialBuffer: string,
    nextInstruction: ProgramLine
}
