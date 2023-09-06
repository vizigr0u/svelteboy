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
    sha1: string,
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

export enum PPUMode {
    HBlank = 0,
    VBlank = 1,
    OAMScan = 2,
    Transfer = 3
}

class PpuInfo {
    currentDot: number;
    currentMode: PPUMode;
    lineSpritesIndices: Array<number>;
}

export type GbDebugInfo = {
    registers: GbRegisterInfo,
    lcd: LcdInfo,
    timer: TimerInfo,
    ppu: PpuInfo,
    currentFrame: number,
    useBootRom: boolean,
    isHalted: boolean,
    isStopped: boolean,
    cycleCount: number,
    interruptsMaster: boolean,
    interruptFlags: number,
    interruptEnabled: number,
    serialBuffer: string,
    nextInstruction: ProgramLine
}

export enum DebugStopReason {
    None = 0,
    HitBreakpoint = 1,
    HitBreakMode = 2,
    CpuStop = 3,
    EndOfFrame = 4,
    UserPause = 5
}

export type OamEntry = {
    posX: number,
    posY: number,
    tileIndex: number,
    behindBG: boolean,
    xFlip: boolean,
    yFlip: boolean
}

export type MemArea = {
    start: number;
    size: number;
    name: string;
};

export enum InputType {
    Right = 1 << 0,
    Left = 1 << 1,
    Up = 1 << 2,
    Down = 1 << 3,
    A = 1 << 4,
    B = 1 << 5,
    Select = 1 << 6,
    Start = 1 << 7,
}

export type SaveGameData = {
    buffer: Uint8Array,
    gameSha1: string,
    name: string
}