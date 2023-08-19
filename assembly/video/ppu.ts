import { IntType, Interrupt } from "../interrupts";
import { Logger, log } from "../logger";
import { LCD_HEIGHT, Lcd, LcdControlBit } from "./lcd";

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

@final
export class Ppu {
    static currentMode: PpuMode = PpuMode.OAMScan;
    static currentDot: u16 = 0;
    static currentFrame: u32 = 0;

    static Init(): void {
        Ppu.currentMode = PpuMode.OAMScan;
        Ppu.currentDot = 0;
        Ppu.currentFrame = 0;

        Lcd.Init();
    }

    static Tick(): void {
        if (!Lcd.gbData().hasControlBit(LcdControlBit.LCDandPPUenabled))
            return;
        if (Logger.verbose >= 3)
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

function tickHblank(): void {
    if (Ppu.currentDot >= SCANLINE_NUM_DOTS) { // end of hblank
        incrementLy();
        if (Lcd.gbData().lY == LCD_HEIGHT) {    // end of display / start of Vblank
            Ppu.currentMode = PpuMode.VBlank;
            Interrupt.Request(IntType.VBlank);

            if (Lcd.gbData().hasStatMode(PpuMode.VBlank)) {
                Interrupt.Request(IntType.LcdSTAT);
            }
            Ppu.currentFrame++;
        } else {
            Ppu.currentMode = PpuMode.OAMScan;
        }
        Ppu.currentDot = 0;
    }
}

function tickVblank(): void {
    if (Ppu.currentDot >= SCANLINE_NUM_DOTS) { // end of line
        incrementLy();

        if (Lcd.gbData().lY == NUM_SCANLINES) { // end of frame
            Ppu.currentMode = PpuMode.OAMScan;
            Lcd.gbData().lY = 0;
        }
        Ppu.currentDot = 0;
    }
}

function tickOAMScan(): void {
    if (Ppu.currentDot >= OAM_SCAN_DOTS) {
        Ppu.currentMode = PpuMode.Transfer;
    }
}

function tickTransfer(): void {
    if (Ppu.currentDot >= OAM_SCAN_DOTS + TRANSFER_MIN_DOTS) { // TODO : transfer can last up to TRANSFER_MAX_DOTS
        Ppu.currentMode = PpuMode.HBlank;
    }
}
