import { Interrupt, IntType } from "../../cpu/interrupts";
import { Logger, log } from "../../debug/logger";
import { LCD_HEIGHT, LCD_RES, LCD_WIDTH } from "./constants";
import { Lcd, LcdControlBit } from "./lcd";
import { Oam, OamData } from "./oam";
import { PpuTransfer } from "./ppuTransfer";

export enum PpuMode {
    HBlank = 0,
    VBlank = 1,
    OAMScan = 2,
    Transfer = 3
}

const NUM_SCANLINES: u16 = 154;

const SCANLINE_NUM_DOTS: u16 = 456;
const OAM_SCAN_DOTS: u16 = 80;
const TRANSFER_MIN_DOTS: u16 = 172;
const TRANSFER_MAX_DOTS: u16 = 289;

const MAX_SPRITES_PER_LINE: u32 = 10;
const MAX_SPRITES_PER_FRAME: u32 = 40;

const FRAME_BUFFER_SIZE: u32 = LCD_RES * 4; // 4 bpp

export class PpuOamFifo {
    static head: i32 = 0;
    static size: i32 = 0;
    static buffer: StaticArray<u8> = new StaticArray<u8>(MAX_SPRITES_PER_LINE);

    static Reset() {
        PpuOamFifo.size = 0;
        PpuOamFifo.head = 0;
    }

    @inline static IsFull(): boolean { return PpuOamFifo.size == PpuOamFifo.buffer.length }

    @inline static IsEmpty(): boolean { return PpuOamFifo.head == PpuOamFifo.size };

    @inline static Dequeue(): OamData { return Oam.view[PpuOamFifo.head++] }

    @inline static Peek(): OamData { return Oam.view[PpuOamFifo.head] }

    static Enqueue(oamIndex: u8): void {
        assert(PpuOamFifo.head == 0, 'Can only insert in this fifo ')
        assert(!PpuOamFifo.IsFull(), 'Trying to insert in full PpuOamFifo');
        const x = Oam.view[oamIndex].xPos;
        let i = 0;
        while (x > Oam.view[PpuOamFifo.buffer[i]].xPos)
            i++;
        for (let j = PpuOamFifo.size; j > i; j--) {
            PpuOamFifo.buffer[j] = PpuOamFifo.buffer[j - 1];
        }
        PpuOamFifo.buffer[i] = oamIndex;
        PpuOamFifo.size++;
    }
}

@final
export class Ppu {
    static currentMode: PpuMode = PpuMode.OAMScan;
    static currentDot: u16 = 0;
    static currentFrame: u32 = 0;

    static spriteCountThisFrame: u8 = 0;

    // frame buffers
    static buffersInitialized: boolean = false;
    static frameBuffers: StaticArray<Uint8ClampedArray> = new StaticArray<Uint8ClampedArray>(2);
    static workingBufferIndex: u8 = 0;
    static workingBuffer: Uint32Array = new Uint32Array(0);

    @inline static DrawnBuffer(): Uint8ClampedArray { return Ppu.frameBuffers[(Ppu.workingBufferIndex + 1) & 1]; }

    static Init(): void {
        Ppu.currentMode = PpuMode.OAMScan;
        Ppu.currentDot = 0;
        Ppu.currentFrame = 0;

        if (Logger.verbose >= 3) {
            log('Initializing PPU');
        }
        Ppu.workingBufferIndex = 0;
        if (!Ppu.buffersInitialized) {
            Ppu.frameBuffers[0] = new Uint8ClampedArray(FRAME_BUFFER_SIZE);
            Ppu.frameBuffers[1] = new Uint8ClampedArray(FRAME_BUFFER_SIZE);
            Ppu.buffersInitialized = true;

            if (Logger.verbose >= 2) {
                log(`PPU buffers initialized to sizes ${Ppu.frameBuffers[0].byteLength} and ${Ppu.frameBuffers[1].byteLength}`);
            }
        } else {
            memory.fill(Ppu.frameBuffers[0].dataStart, 0, FRAME_BUFFER_SIZE);
            memory.fill(Ppu.frameBuffers[1].dataStart, 0, FRAME_BUFFER_SIZE);
            if (Logger.verbose >= 2) {
                log(`PPU buffers content Reset, sizes: ${Ppu.frameBuffers[0].byteLength} and ${Ppu.frameBuffers[1].byteLength}`);
            }
        }
        Ppu.workingBuffer = Uint32Array.wrap(Ppu.frameBuffers[Ppu.workingBufferIndex].buffer);

        Lcd.Init();
    }

    static Tick(): void {
        // if (!Lcd.gbData().hasControlBit(LcdControlBit.LCDandPPUenabled))
        //     return;
        if (Logger.verbose >= 4)
            log('PPU TICK');
        Ppu.currentDot++;

        switch (Ppu.currentMode) {
            case PpuMode.HBlank:
                tickHblank();
                break;
            case PpuMode.VBlank:
                tickVblank();
                break;
            case PpuMode.OAMScan:
                tickOAMScan();
                break;
            case PpuMode.Transfer:
                tickTransfer();
                break;
            default:
                assert(false, 'PPU in wrong mode');
        }
    }
}

function incrementLy(): void {
    const data = Lcd.gbData();
    data.lY++;
    if (data.lY == data.lYcompare) {
        data.stat = data.stat | 0b100; // set STAT LYC=LY Flag
        if (data.stat & 0b10000000) // request STAT int on LY=LYC
            Interrupt.Request(IntType.LcdSTAT);
    } else {
        data.stat = data.stat & ~0b100; // reset STAT LYC=LY Flag
    }
}

function enterMode(mode: PpuMode): void {
    if (Logger.verbose >= 3)
        log('PPU going from mode ' + Ppu.currentMode.toString() + ' to ' + mode.toString());
    Ppu.currentMode = mode;
    switch (mode) {
        case PpuMode.HBlank:
            PpuTransfer.bgFifo.Clear();
            if (Lcd.gbData().hasStatMode(PpuMode.HBlank)) {
                Interrupt.Request(IntType.LcdSTAT);
            }
            break;
        case PpuMode.VBlank:
            Interrupt.Request(IntType.VBlank);
            if (Lcd.gbData().hasStatMode(PpuMode.VBlank)) {
                Interrupt.Request(IntType.LcdSTAT);
            }
            Ppu.currentFrame++;
            Ppu.spriteCountThisFrame = 0;
            Ppu.workingBufferIndex = (Ppu.workingBufferIndex + 1) & 1;
            Ppu.workingBuffer = Uint32Array.wrap(Ppu.frameBuffers[Ppu.workingBufferIndex].buffer);
            break;
        case PpuMode.OAMScan:
            gatherLineSprites();
            break;
        case PpuMode.Transfer:
            PpuTransfer.Init();
            break;
        default:
            break;
    }
}

function tickHblank(): void {
    if (Ppu.currentDot >= SCANLINE_NUM_DOTS) { // end of hblank
        incrementLy();
        enterMode(Lcd.gbData().lY >= LCD_HEIGHT ? PpuMode.VBlank : PpuMode.OAMScan);
        Ppu.currentDot = 0;
    }
}

function tickVblank(): void {
    if (Ppu.currentDot >= SCANLINE_NUM_DOTS) { // end of line
        incrementLy();
        if (Lcd.gbData().lY >= NUM_SCANLINES) { // end of frame
            enterMode(PpuMode.OAMScan);
            Lcd.gbData().lY = 0;
        }
        Ppu.currentDot = 0;
    }
}

function tickOAMScan(): void {
    if (Ppu.currentDot >= OAM_SCAN_DOTS) {
        enterMode(PpuMode.Transfer);
    }
}

function tickTransfer(): void {
    PpuTransfer.Tick();
    if (PpuTransfer.pushedX == LCD_WIDTH) {
        enterMode(PpuMode.HBlank);
    }
}

function gatherLineSprites() {
    PpuOamFifo.Reset();
    const ly = Lcd.gbData().lY;
    const spriteHeight = Lcd.gbData().hasControlBit(LcdControlBit.ObjSize) ? 16 : 8;
    const oams = Oam.view;
    for (let i = 0; i < oams.length() && !PpuOamFifo.IsFull(); i++) {
        if (oams[i].xPos == 0)
            continue;

        const oam = oams[i];
        if (oam.yPos <= ly + 16 && oam.yPos + spriteHeight > ly + 16) {
            PpuOamFifo.Enqueue(i);
        }
    }
}
