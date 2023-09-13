import { Cpu } from "../../cpu/cpu";
import { GB_VIDEO_BANK_SIZE, GB_VIDEO_START } from "../../memory/memoryConstants";
import { Logger } from "../../debug/logger";
import { LCD_WIDTH } from "./constants";
import { Lcd, LcdControlBit } from "./lcd";
import { OamAttribute } from "./oam";
import { Ppu, PpuOamFifo } from "./ppu";
import { uToHex } from "../../utils/stringUtils";


function log(s: string): void {
    Logger.Log("PPU-scanline: " + s);
}

// const PIXEL_FIFO_SIZE: u32 = 16;

@final
export class ScanlineRenderer {
    private static pixels: StaticArray<u8> = new StaticArray<u8>(LCD_WIDTH);

    static Init(): void {
    }

    static Tick(): void {
    }

    @inline
    private static isInWindow(x: u8, winX: u16): boolean {
        return x + 7 >= winX && x + 7 < winX + LCD_WIDTH + 14;
    }

    static Render(): void {
        const pixels = ScanlineRenderer.pixels;
        const lcd = Lcd.data;
        const y = lcd.lY;
        const tileY = ((lcd.lY + lcd.scrollY) & 7) << 1;

        const winX = lcd.windowX;
        const winVisible = Lcd.IsWindowVisible;
        const BgPalette: u8 = Lcd.getBGPalette();

        // bg and win
        if (Lcd.BGandWindowVisible) {
            const tileBaseIsLow = Lcd.data.hasControlBit(LcdControlBit.BGandWindowTileArea);
            const offset: u8 = lcd.scrollX & 7;
            for (let x: u8 = 0; x < LCD_WIDTH;) { // TODO better
                const inWindow = winVisible && ScanlineRenderer.isInWindow(x, winX);
                const mapBase = inWindow ? Lcd.WindowTileMapBaseAddress : Lcd.BgTileMapBaseAddress;
                const mapX: u8 = inWindow ? x + 7 - lcd.windowX : x + lcd.scrollX;
                const mapY: u8 = inWindow ? Lcd.WindowLineY : lcd.lY + lcd.scrollY;

                const dataIndex: u8 = load<u8>(mapBase + (mapX >> 3) + (<u16>(mapY >> 3) << 5));
                const bgTileOffset: i16 = tileBaseIsLow ? <i16>dataIndex : <i16><u8>(dataIndex + 128);
                const tileByteAddress: u32 = Lcd.TilesBaseAddress + (bgTileOffset * 16) + tileY;
                if (tileByteAddress < GB_VIDEO_START || tileByteAddress >= (GB_VIDEO_START + GB_VIDEO_BANK_SIZE)) {
                    const error = `Invalid pointer: ${uToHex<u32>(tileByteAddress)} (GB ${uToHex<u32>(tileByteAddress - GB_VIDEO_START + 0x8000)})\n`
                        + `TilesBaseAddress = ${uToHex<u32>(Lcd.TilesBaseAddress)}, tileOffset = ${bgTileOffset}, *16 = ${(bgTileOffset * 16)}, tileY = ${tileY} \n`
                        + Cpu.GetTrace();
                    log(error)
                    console.log(error)
                    // Cpu.isStopped = true;
                    assert(false, error)
                    return;
                }
                const fetchedBgBytes = load<u16>(tileByteAddress);
                const startI: i16 = !inWindow && x == 0 ? offset : 0;
                // const startI = x - offset < 0 ? offset - x : 0;
                const endI: i16 = !inWindow && x + 8 > LCD_WIDTH ? offset : 8;
                if (Logger.verbose >= 4) {
                    log(`tile ${dataIndex} from ${startI}  to ${endI} (offset: ${offset})`);
                }
                for (let i = startI; i < endI; i++) {
                    const bgMask: u8 = (1 << <u8>(7 - i));
                    const bgColorId: u8 = Ppu.getColorIndexFromBytes(fetchedBgBytes, bgMask);
                    unchecked(pixels[x++] = bgColorId);
                }
            }
        }

        // sprites
        if (Lcd.SpritesVisible) {
            const spriteHeight = Lcd.SpriteHeight;
            for (let x: u8 = 0; x < LCD_WIDTH; x++) {
                const numSpritesThisFetch: i32 = <i32>PpuOamFifo.GetSpriteIndicesFor(x);
                const bgColorId = unchecked(pixels[x]);
                let color: u8 = Ppu.applyPalette(Lcd.BGandWindowVisible ? bgColorId : 0, BgPalette);
                for (let i = 0; i < numSpritesThisFetch; i++) {
                    const oam = PpuOamFifo.Peek(i);

                    if (oam.hasAttr(OamAttribute.BGandWindowOver) && bgColorId != 0)
                        continue;

                    let spriteY = (y + 16 - oam.yPos);
                    if (oam.hasAttr(OamAttribute.YFlip))
                        spriteY = (spriteHeight - 1) - spriteY;

                    const tileIndex: u16 = spriteHeight == 16 ? (oam.tileIndex & ~1) : oam.tileIndex;
                    const spriteBytes: u16 = unchecked(load<u16>(GB_VIDEO_START + (<u16>tileIndex * 16) + spriteY * 2));
                    if (Logger.verbose >= 4) {
                        log(`Fetched bytes from tileIndex ${tileIndex} Y: ${spriteY} => ${(spriteBytes >> 8).toString(2).padStart(8, '0')} and ${(spriteBytes & 8).toString(2).padStart(8, '0')}`)
                    }

                    const spriteX: i16 = <i16><u8>oam.xPos - 8;
                    const offset: i16 = spriteX - x; // [-7, 0] if sprite is [x - 7, x]
                    if (Logger.verbose >= 4) {
                        log(`Fetching pixel ${x + i} on ${oam.tileIndex}: spriteX=${spriteX}, offset=${offset}`)
                    }
                    if (offset < -7 || offset > 0)
                        continue;

                    const bit: u8 = <u8>(oam.hasAttr(OamAttribute.XFlip) ? -offset : offset + 7); // [7-0] or [0-7] when flipped
                    assert((bit & 7) == bit);
                    const spriteBitMask: u8 = (1 << bit);
                    const spriteColorId = Ppu.getColorIndexFromBytes(unchecked(spriteBytes), spriteBitMask)
                    if (spriteColorId != 0) {

                        const spritePalette = oam.hasAttr(OamAttribute.PaletteNumber) ? Lcd.data.objPalette1 : Lcd.data.objPalette0;
                        color = Ppu.applyPalette(spriteColorId, spritePalette & 0b11111100); // lower 2 bits of palette ignored for transparency
                        break;
                    }
                }
                unchecked(pixels[x] = color);
            }
        }

        const bufferOffset = Lcd.data.lY * LCD_WIDTH;
        for (let x: u8 = 0; x < LCD_WIDTH; x++) {
            const color32 = unchecked(Ppu.current32bitPalette[unchecked(pixels[x])]);
            unchecked(Ppu.workingBuffer[x + bufferOffset] = color32);
        }
    }
}
