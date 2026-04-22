import { IntType, Interrupt } from "../../cpu/interrupts";
import { IO } from "../io";
import { Logger } from "../../debug/logger";
import { GB_IO_START, GB_VIDEO_START, GB_CGB_PALETTE_RAM_START, GB_CGB_PALETTE_RAM_SIZE } from "../../memory/memoryConstants";
import { uToHex } from "../../utils/stringUtils";
import { Ppu, PpuMode } from "./ppu";
import { Dma } from "./dma";
import { LCD_HEIGHT } from "./constants";
import { CgbState } from "../../cgbState";

const VBK_ADDRESS: u16 = 0xFF4F;

const BCPS_ADDRESS: u16 = 0xFF68;
const BCPD_ADDRESS: u16 = 0xFF69;
const OCPS_ADDRESS: u16 = 0xFF6A;
const OCPD_ADDRESS: u16 = 0xFF6B;

const CGB_OBJ_PALETTE_OFFSET: u32 = 64; // BG palette = [0..63], OBJ palette = [64..127]

const LCD_GB_START_ADDRESS: u16 = 0xFF40;
const LCD_GBC_START_ADDRESS: u16 = 0xFF4D;

const TILE_BASE_LO: u32 = GB_VIDEO_START;
const TILE_BASE_HI: u32 = GB_VIDEO_START + <u32>0x800;
const MAP_BASE_LO: u32 = GB_VIDEO_START + <u32>0x1800;
const MAP_BASE_HI: u32 = GB_VIDEO_START + <u32>0x1C00;

function log(s: string): void {
    Logger.Log("IO: " + s);
}

export enum LcdControlBit {
    BGandWindowEnabled = 0,
    ObjEnabled = 1,
    ObjSize = 2,                // 0=8×8, 1=8×16
    BGTileMapArea = 3,          // 0=9800-9BFF, 1=9C00-9FFF
    BGandWindowTileArea = 4,    // 0=8800-97FF, 1=8000-8FFF
    WindowEnabled = 5,
    WindowTileMapArea = 6,      // 0=9800-9BFF, 1=9C00-9FFF
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
    static getControlAddress(): u16 {
        return LCD_GB_START_ADDRESS + <u16>offsetof<LcdGbData>('control');
    }

    @inline
    static getStatAddress(): u16 {
        return LCD_GB_START_ADDRESS + <u16>offsetof<LcdGbData>('stat');
    }

    @inline
    static getDmaAddress(): u16 {
        return LCD_GB_START_ADDRESS + <u16>offsetof<LcdGbData>('dma');
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

    @inline spriteHeight(): u8 { return this.hasControlBit(LcdControlBit.ObjSize) ? 16 : 8 };

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
    private static windowLy: u8 = 0;

    private static _spriteHeight: u8 = 8;
    private static _ppuEnabled: boolean = true;
    private static _windowEnabled: boolean = true;
    private static _spritesVisible: boolean = true;
    private static _bgAndWindowEnabled: boolean = true;
    private static _windowVisible: boolean = false;
    private static _bgTileMapBaseAddress: u32 = MAP_BASE_LO;
    private static _windowTileMapBaseAddress: u32 = MAP_BASE_LO;
    private static _TilesBaseAddress: u32 = TILE_BASE_LO;

    // CGB palette index registers (bit 7 = auto-increment, bits 0-5 = index)
    private static _bcps: u8 = 0;
    private static _ocps: u8 = 0;

    static Init(): void {
        if (Logger.verbose >= 3) {
            log('Initializing Lcd');
        }
        Lcd.ResetLine();
        memory.fill(LcdGbData.getGlobalPointer(), 0, offsetof<LcdGbData>());
        // DMG post-boot register values
        const data = Lcd.data;
        data.control = 0x91;  // LCDC: PPU on, BG tile data $8000, BG enabled
        data.bgPalette = 0xFC; // BGP: $FC
        // Sync internal flags from LCDC
        Lcd._ppuEnabled = data.hasControlBit(LcdControlBit.LCDandPPUenabled);
        Lcd._windowEnabled = data.hasControlBit(LcdControlBit.WindowEnabled);
        Lcd._spritesVisible = data.hasControlBit(LcdControlBit.ObjEnabled);
        Lcd._bgAndWindowEnabled = data.hasControlBit(LcdControlBit.BGandWindowEnabled);
        Lcd._spriteHeight = data.spriteHeight();
        Lcd._bgTileMapBaseAddress = data.hasControlBit(LcdControlBit.BGTileMapArea) ? MAP_BASE_HI : MAP_BASE_LO;
        Lcd._windowTileMapBaseAddress = data.hasControlBit(LcdControlBit.WindowTileMapArea) ? MAP_BASE_HI : MAP_BASE_LO;
        Lcd._TilesBaseAddress = data.hasControlBit(LcdControlBit.BGandWindowTileArea) ? TILE_BASE_LO : TILE_BASE_HI;
        CgbState.setVramBank(0);
        Lcd._bcps = 0;
        Lcd._ocps = 0;
        memory.fill(GB_CGB_PALETTE_RAM_START, 0, GB_CGB_PALETTE_RAM_SIZE);
    }

    @inline static get IsPpuEnabled(): boolean { return Lcd._ppuEnabled };
    @inline static get IsWindowVisible(): boolean { return Lcd._windowVisible };
    @inline static get BGandWindowVisible(): boolean { return Lcd._bgAndWindowEnabled };
    @inline static get SpritesVisible(): boolean { return Lcd._spritesVisible };
    @inline static get SpriteHeight(): u8 { return Lcd._spriteHeight };
    @inline static get BgTileMapBaseAddress(): u32 { return Lcd._bgTileMapBaseAddress };
    @inline static get WindowTileMapBaseAddress(): u32 { return Lcd._windowTileMapBaseAddress };
    @inline static get TilesBaseAddress(): u32 { return Lcd._TilesBaseAddress };

    @inline
    static get data(): LcdGbData {
        return LcdGbData.get();
    }

    @inline
    static setLY(lY: u8): void {
        Lcd.data.lY = lY;
        Lcd.CheckStatInterrupt(lY, Lcd.data.lYcompare);
    }

    @inline
    static get WindowLineY(): u8 { return Lcd.windowLy; }

    @inline static get WindowLyInternal(): u8 { return Lcd.windowLy; }
    static set WindowLyInternal(value: u8) { Lcd.windowLy = value; }
    @inline static get WindowVisibleInternal(): boolean { return Lcd._windowVisible; }
    static set WindowVisibleInternal(value: boolean) { Lcd._windowVisible = value; }

    @inline
    static getBGPalette(): u8 {
        return load<u8>(GB_IO_START + 0x47);
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return (gbAddress >= LCD_GB_START_ADDRESS && gbAddress < (LCD_GB_START_ADDRESS + offsetof<LcdGbData>()))
            || (CgbState.isCgbMode && (gbAddress == VBK_ADDRESS
                || gbAddress == BCPS_ADDRESS || gbAddress == BCPD_ADDRESS
                || gbAddress == OCPS_ADDRESS || gbAddress == OCPD_ADDRESS));
    }

    static SyncFromMemory(): void {
        const data = Lcd.data;
        Lcd._windowEnabled = data.hasControlBit(LcdControlBit.WindowEnabled);
        Lcd._bgAndWindowEnabled = data.hasControlBit(LcdControlBit.BGandWindowEnabled);
        Lcd._spritesVisible = data.hasControlBit(LcdControlBit.ObjEnabled);
        Lcd._spriteHeight = data.spriteHeight();
        Lcd._ppuEnabled = data.hasControlBit(LcdControlBit.LCDandPPUenabled);
        Lcd._bgTileMapBaseAddress = data.hasControlBit(LcdControlBit.BGTileMapArea) ? MAP_BASE_HI : MAP_BASE_LO;
        Lcd._windowTileMapBaseAddress = data.hasControlBit(LcdControlBit.WindowTileMapArea) ? MAP_BASE_HI : MAP_BASE_LO;
        Lcd._TilesBaseAddress = data.hasControlBit(LcdControlBit.BGandWindowTileArea) ? TILE_BASE_LO : TILE_BASE_HI;
    }

    static Store(gbAddress: u16, value: u8): void {
        if (gbAddress == VBK_ADDRESS) {
            if (CgbState.isCgbMode)
                CgbState.setVramBank(<u32>(value & 1));
            return;
        }
        if (gbAddress == BCPS_ADDRESS) {
            Lcd._bcps = value & 0xBF; // bit 6 unused, always 0
            return;
        }
        if (gbAddress == BCPD_ADDRESS) {
            const idx = Lcd._bcps & 0x3F;
            store<u8>(GB_CGB_PALETTE_RAM_START + idx, value);
            if (Lcd._bcps & 0x80)
                Lcd._bcps = ((idx + 1) & 0x3F) | 0x80;
            return;
        }
        if (gbAddress == OCPS_ADDRESS) {
            Lcd._ocps = value & 0xBF;
            return;
        }
        if (gbAddress == OCPD_ADDRESS) {
            const idx = Lcd._ocps & 0x3F;
            store<u8>(GB_CGB_PALETTE_RAM_START + CGB_OBJ_PALETTE_OFFSET + idx, value);
            if (Lcd._ocps & 0x80)
                Lcd._ocps = ((idx + 1) & 0x3F) | 0x80;
            return;
        }
        if (gbAddress == LcdGbData.getDmaAddress()) {
            Dma.Start(value);
        }
        if (gbAddress == LcdGbData.getControlAddress()
            && Lcd._ppuEnabled
            && (value & (1 << <u8>LcdControlBit.LCDandPPUenabled)) == 0
            && Ppu.currentMode != PpuMode.VBlank) {
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
            Lcd.CheckStatInterrupt(Lcd.data.lY, value);
        }
        IO.MemStore<u8>(gbAddress, value);
        if (gbAddress == LcdGbData.getControlAddress()) {
            const wasEnabled = Lcd._ppuEnabled;
            Lcd._windowEnabled = Lcd.data.hasControlBit(LcdControlBit.WindowEnabled);
            Lcd._bgAndWindowEnabled = Lcd.data.hasControlBit(LcdControlBit.BGandWindowEnabled);
            Lcd._spritesVisible = Lcd.data.hasControlBit(LcdControlBit.ObjEnabled);
            Lcd._spriteHeight = Lcd.data.spriteHeight();
            Lcd._ppuEnabled = Lcd.data.hasControlBit(LcdControlBit.LCDandPPUenabled);
            Lcd._bgTileMapBaseAddress = Lcd.data.hasControlBit(LcdControlBit.BGTileMapArea) ? MAP_BASE_HI : MAP_BASE_LO;
            Lcd._windowTileMapBaseAddress = Lcd.data.hasControlBit(LcdControlBit.WindowTileMapArea) ? MAP_BASE_HI : MAP_BASE_LO;
            Lcd._TilesBaseAddress = Lcd.data.hasControlBit(LcdControlBit.BGandWindowTileArea) ? TILE_BASE_LO : TILE_BASE_HI;
            if (wasEnabled && !Lcd._ppuEnabled) {
                // PPU disabled: reset LY to 0, fix mode to HBlank, reset dot counter
                Lcd.data.lY = 0;
                Lcd.windowLy = 0;
                Lcd._windowVisible = false;
                Ppu.currentMode = PpuMode.HBlank;
                Ppu.currentDot = 0;
            }
        }
    }

    static Load(gbAddress: u16): u8 {
        if (gbAddress == VBK_ADDRESS)
            return <u8>(CgbState.vramBank | 0xFE);
        if (gbAddress == BCPS_ADDRESS)
            return Lcd._bcps | 0x40; // bit 6 reads as 1
        if (gbAddress == BCPD_ADDRESS)
            return load<u8>(GB_CGB_PALETTE_RAM_START + (Lcd._bcps & 0x3F));
        if (gbAddress == OCPS_ADDRESS)
            return Lcd._ocps | 0x40;
        if (gbAddress == OCPD_ADDRESS)
            return load<u8>(GB_CGB_PALETTE_RAM_START + CGB_OBJ_PALETTE_OFFSET + (Lcd._ocps & 0x3F));
        const data = Lcd.data;
        if (Logger.verbose >= 4)
            log(`LCD read at ${uToHex(gbAddress)} - data = ${data.lY}`);
        if (gbAddress == LcdGbData.getStatAddress()) {
            let stat = data.stat & 0b11111000;
            stat |= (data.lY == data.lYcompare) ? 0b100 : 0;
            if (Lcd.IsPpuEnabled)
                stat |= <u8>Ppu.currentMode;
            return stat;
        }
        return IO.MemLoad<u8>(gbAddress);
    }

    private static isWindowVisible(): boolean {
        const lcd = Lcd.data;
        return Lcd._windowEnabled
            && Lcd._bgAndWindowEnabled
            && lcd.lY >= lcd.windowY && lcd.lY < lcd.windowY + LCD_HEIGHT
            && lcd.windowX >= 0 && lcd.windowX <= 166;
    }

    static NextLine(): void {
        const data = Lcd.data;
        const wasWindowVisible = Lcd._windowVisible;
        data.lY++;
        Lcd._windowVisible = Lcd.isWindowVisible();
        if (wasWindowVisible) {
            Lcd.windowLy++;
        }
        if (data.lY == data.lYcompare) {
            data.stat = data.stat | 0b100;  // set STAT LYC=LY Flag
            if (data.stat & 0b1000000)      // request STAT int on LY=LYC
                Interrupt.Request(IntType.LcdSTAT);
        } else {
            data.stat = data.stat & ~0b100; // reset STAT LYC=LY Flag
        }
    }

    static ResetLine(): void {
        const data = Lcd.data;
        data.lY = 0;
        Lcd.windowLy = 0;
        Lcd._windowVisible = Lcd.isWindowVisible();
        if (data.lYcompare == 0) {
            data.stat = data.stat | 0b100;
            if (data.stat & 0b1000000)
                Interrupt.Request(IntType.LcdSTAT);
        } else {
            data.stat = data.stat & ~0b100;
        }
    }

    static CheckStatInterrupt(ly: u8, lyc: u8): void {
        const data = Lcd.data;
        if (ly == lyc) {
            data.stat = data.stat | 0b100;
            if (data.stat & 0b1000000) {
                if (Logger.verbose >= 3)
                    log(`LY == LYC == ${ly} -> INT LCD_FLAG`);
                Interrupt.Request(IntType.LcdSTAT);
            }
        } else {
            data.stat = data.stat & ~0b100;
        }
    }

    @inline
    static getCGBBgColor(paletteNum: u8, colorIdx: u8): u16 {
        const offset = <u32>(paletteNum) * 8 + <u32>(colorIdx) * 2;
        return load<u16>(GB_CGB_PALETTE_RAM_START + offset);
    }

    @inline
    static getCGBObjColor(paletteNum: u8, colorIdx: u8): u16 {
        const offset = <u32>(paletteNum) * 8 + <u32>(colorIdx) * 2;
        return load<u16>(GB_CGB_PALETTE_RAM_START + CGB_OBJ_PALETTE_OFFSET + offset);
    }
}
