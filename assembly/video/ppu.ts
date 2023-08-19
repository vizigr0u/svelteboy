import { LCD_HEIGHT, Lcd } from "./lcd";

export enum PpuMode {
    HBlank = 0,
    VBlank = 1,
    OAMScan = 2,
    Transfer = 3
}

const NUM_SCANLINES: u16 = 154;

const SCANLINE_NUM_DOTS: u16 = 456;
const OAM_SCAN_TIME: u16 = 80;
const TRANSFER_MIN_TIME: u16 = 172;
const TRANSFER_MAX_TIME: u16 = 289;

@final
export class Ppu {
    static currentMode: PpuMode = PpuMode.OAMScan;
    static currentDot: u16 = 0;

    static Init(): void {
        Ppu.currentMode = PpuMode.OAMScan;
        Ppu.currentDot = 0;

    }

    static Tick(): void {
        Ppu.currentDot++;
        let ly = Lcd.gbData().lY;
        switch (Ppu.currentMode) {
            case PpuMode.HBlank:
                if (Ppu.currentDot == SCANLINE_NUM_DOTS) {
                    ly++;
                    if (ly == LCD_HEIGHT) {
                        Ppu.currentMode = PpuMode.VBlank;
                    } else {
                        Ppu.currentMode = PpuMode.OAMScan;
                    }
                    Ppu.currentDot = 0;
                }
                Lcd.gbData().lY = ly;
                break;
            case PpuMode.VBlank:

                break;
            case PpuMode.OAMScan:
                break;
            case PpuMode.Transfer:
                break;
            default:
                assert(false, 'PPU in wrong mode');
        }
    }
}
