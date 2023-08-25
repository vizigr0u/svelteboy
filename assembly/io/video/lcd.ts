import { Debug } from "../../debug/debug";
import { IntType, Interrupt } from "../../cpu/interrupts";
import { IO } from "../io";
import { Logger, log } from "../../debug/logger";
import { GB_IO_START } from "../../cpu/memoryConstants";
import { uToHex } from "../../utils/stringUtils";
import { Ppu, PpuMode } from "./ppu";
import { DMA_ADDRESS, Dma } from "./dma";

const LCD_GB_START_ADDRESS: u16 = 0xFF40;
const LCD_GBC_START_ADDRESS: u16 = 0xFF4D;

export enum LcdControlBit {
    BGandWindowEnabled = 0,
    ObjEnabled = 1,
    ObjSize = 2,
    BGTileMapArea = 3,
    BGandWindowTileArea = 4,
    WindowEnabled = 5,
    WindowTileMapArea = 6,
    LCDandPPUenabled = 7
}

@final
class LcdGbData {
    control: u8;
    stat: u8;
    scrollY: u8;
    scrollX: u8;
    lY: u8;
    lYcompare: u8;
    dma: u8;
    bgPalette: u8;
    objPalette0: u8;
    objPalette1: u8;
    windowY: u8;
    windowX: u8;

    @inline
    static getGlobalPointer(): usize {
        return <usize>(GB_IO_START + LCD_GB_START_ADDRESS - 0xFF00);
    }

    @inline
    static get(): LcdGbData {
        return changetype<LcdGbData>(LcdGbData.getGlobalPointer());
    }

    @inline
    static getStatAddress(): u16 {
        return LCD_GB_START_ADDRESS + <u16>offsetof<LcdGbData>('stat');
    }

    @inline
    static getLyAddress(): u16 {
        return LCD_GB_START_ADDRESS + <u16>offsetof<LcdGbData>('lY');
    }

    @inline
    static getLyCompareAddress(): u16 {
        return LCD_GB_START_ADDRESS + <u16>offsetof<LcdGbData>('lYcompare');
    }

    @inline
    getStatModes(): u8 {
        return (this.stat >> 3) & 3;
    }

    @inline
    hasStatMode(mode: PpuMode): boolean {
        return mode == PpuMode.Transfer ? false : ((1 << mode) & (this.stat >> 3)) != 0;
    }

    hasControlBit(b: LcdControlBit): boolean { return (this.control & (1 << <u8>b)) != 0; }

    setControlBit(b: LcdControlBit, enabled: bool = 1): void {
        if (enabled)
            this.control = this.control | (1 << b);
        else
            this.control = this.control & ~(1 << b);
    }

}

@final
export class Lcd {
    static currentPalette: u8;

    static Init(): void {
        if (Logger.verbose >= 3) {
            log('Initializing Lcd');
        }
        memory.fill(LcdGbData.getGlobalPointer(), 0, offsetof<LcdGbData>()); // TODO: what are initial values?
        if (Debug.disableLcdForTests) {
            if (Logger.verbose >= 1)
                log('LCD disabld for tests');
            Lcd.gbData().lY = 0xFF;
        }
    }

    @inline
    static gbData(): LcdGbData {
        return LcdGbData.get();
    }

    @inline
    static setLY(lY: u8): void {
        Lcd.gbData().lY = lY;
        Lcd.CheckStatInterrupt(lY, Lcd.gbData().lYcompare);
    }

    @inline
    static getBGPalette(): u8 {
        return load<u8>(GB_IO_START + 0x47);
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return (gbAddress >= LCD_GB_START_ADDRESS && gbAddress < (LCD_GB_START_ADDRESS + offsetof<LcdGbData>()));
    }

    static Store(gbAddress: u16, value: u8): void {
        if (gbAddress == DMA_ADDRESS) {
            // Dma.Start(value);
            return;
        }
        if (gbAddress == LcdGbData.getLyAddress()) {
            if (Logger.verbose >= 1)
                log('Unexpected/forbidden write to LY');
            return;
        }
        if (gbAddress == LcdGbData.getStatAddress()) {
            const filteredValue = value & 0b11111000;
            if (filteredValue != value)
                if (Logger.verbose >= 2)
                    log('Ignoring unexpected writes to readonly LCD STAT bits ' + uToHex<u8>(value));
            value = filteredValue;
        } else if (gbAddress == LcdGbData.getLyCompareAddress()) {
            Lcd.CheckStatInterrupt(Lcd.gbData().lY, value);
        }
        IO.MemStore<u8>(gbAddress, value);
    }

    static Load(gbAddress: u16): u8 {
        const data = Lcd.gbData();
        if (Logger.verbose >= 4)
            log(`LCD read at ${uToHex(gbAddress)} - data = ${data.lY}`);
        if (gbAddress == LcdGbData.getStatAddress()) {
            let stat = data.stat & 0b11111000;
            stat |= (data.lY == data.lYcompare) ? 0b100 : 0;
            stat |= <u8>Ppu.currentMode;
            return stat;
        }
        return IO.MemLoad<u8>(gbAddress);
    }

    static CheckStatInterrupt(ly: u8, lyc: u8): void {
        if (ly == lyc && Interrupt.IsEnabled(IntType.LcdSTAT)) {
            if (Logger.verbose >= 3)
                log(`LY == LYC == ${ly} -> INT LCD_FLAG`);
            Interrupt.Request(IntType.LcdSTAT);
        }
    }
}
