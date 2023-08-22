import { Interrupt, IntType } from "../../cpu/interrupts";
import { Logger, log } from "../../debug/logger";
import { LCD_HEIGHT, LCD_RES, LCD_WIDTH } from "./constants";
import { Lcd } from "./lcd";
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

const FRAME_BUFFER_SIZE: u32 = LCD_RES * 4; // 4 bpp

@final
export class Ppu {
    static currentMode: PpuMode = PpuMode.OAMScan;
    static currentDot: u16 = 0;
    static currentFrame: u32 = 0;
    static buffersInitialized: boolean = false;
    static frameBuffers: StaticArray<Uint8ClampedArray> = new StaticArray<Uint8ClampedArray>(2);
    static workingBufferIndex: u8 = 0;

    @inline static WorkingBuffer(): Uint32Array { return Uint32Array.wrap(Ppu.frameBuffers[Ppu.workingBufferIndex].buffer); }
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
            PpuTransfer.fifo.Clear();
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
            Ppu.workingBufferIndex = (Ppu.workingBufferIndex + 1) & 1;

            break;
        case PpuMode.OAMScan:
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
    // if (PpuTransfer.pushedX >= LCD_WIDTH) { // TODO: replace below
    if (Ppu.currentDot >= OAM_SCAN_DOTS + TRANSFER_MIN_DOTS) { // entering HBlank
        enterMode(PpuMode.HBlank);
    }
}
