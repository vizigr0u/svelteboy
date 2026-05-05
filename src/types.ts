export enum DragState {
    Idle,
    Accept,
    Reject,
}

export interface ProgramLine {
    pc: number;
    opCode: number;
    byteSize: number;
    cycleCounts: number[];
    prefixed: boolean;
    op: string;
    parameters: string[];
};

export interface RomReference {
    name: string,
    sha1: string
};

export type RomSource =
    | { kind: 'idb' }
    | { kind: 'uri'; uri: string }
    | { kind: 'cloud'; provider: string; ref: string };

export interface LibraryRom extends RomReference {
    source: RomSource;
    fileSize?: number;
    addedAt: number;
    originUri?: string;
    favorite?: boolean;
    lastPlayedAt?: number;
    cgbFlag?: number;
    renderMode?: 'auto' | 'force-gb' | 'force-cgb';
}

export interface BootRomEntry extends RomReference {
    content: ArrayBuffer,
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
    currentDot: number = 0;
    currentMode: PPUMode = PPUMode.HBlank;
    lineSpritesIndices: Array<number> = [];
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
    cycleCount: bigint,
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
    UserPause = 5,
    TargetCyclesReached = 6,
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

export type CheatWatch = {
    name: string;
    address: number;
    size: number; // bytes, 1-4
    freeze?: boolean;
    freezeValue?: number;
    valueMapName?: string;
};

export type ValueMap = {
    name: string;
    entries: Record<string, string>; // key = decimal value as string (JSON-safe)
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

export type RemoteRomLocation = {
    filename: string,
    location: string,
    sha1: string
}

export type RemoteRomsList = {
    baseuri: string,
    roms: RemoteRomLocation[]
}

export enum AudioChannel {
    Left = 0,
    Right = 1
}

export type KeyBindings = {
    a: string;
    b: string;
    start: string;
    select: string;
    up: string;
    down: string;
    left: string;
    right: string;
}
