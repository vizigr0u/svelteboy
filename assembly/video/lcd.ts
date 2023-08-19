import { Debug } from "../debug";
import { IntType, Interrupt } from "../interrupts";
import { IO } from "../io";
import { Logger, log } from "../logger";
import { GB_IO_START } from "../memoryMap";
import { uToHex } from "../stringUtils";
import { Ppu } from "./ppu";

const LCD_GB_START_ADDRESS: u16 = 0xFF40;
const LCD_GBC_START_ADDRESS: u16 = 0xFF4D;

export const LCD_WIDTH: u8 = 160;
export const LCD_HEIGHT: u8 = 144;

@final
class LcdGbData {
    control: u8;
    stat: u8;
    scY: u8;
    scX: u8;
    lY: u8;
    lYcompare: u8;
    dma: u8;

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
}

@final
export class Lcd {
    static Init(): void {
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
    static getPalette(): u8 {
        return IO.Load(0xFF47);
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return (gbAddress >= LCD_GB_START_ADDRESS && gbAddress < (LCD_GB_START_ADDRESS + offsetof<LcdGbData>()));
    }

    static Store(gbAddress: u16, value: u8): void {
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
        // TODO temporary hack for Ly to bypass vblank loops
        if (gbAddress == LcdGbData.getLyAddress()) {
            data.lY = (data.lY + 1) % 154;
            if (Debug.disableLcdForTests) {
                if (Logger.verbose >= 1)
                    log('LCD disabld for tests');
                return 0xFF;
            }
        }
        if (gbAddress == LcdGbData.getStatAddress()) {
            let stat = data.stat & 0b11111000;
            stat |= (data.lY == data.lYcompare) ? 0b100 : 0;
            stat |= <u8>Ppu.currentMode;
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
