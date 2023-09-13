import { Cpu } from "../../cpu/cpu";
import { GB_VIDEO_BANK_SIZE, GB_VIDEO_START } from "../../memory/memoryConstants";
import { Logger } from "../../debug/logger";
import { LCD_WIDTH } from "./constants";
import { Lcd, LcdControlBit } from "./lcd";
import { OamAttribute } from "./oam";
import { Ppu, PpuOamFifo } from "./ppu";
import { PixelFifo } from "./pixelFifo";
import { uToHex } from "../../utils/stringUtils";

enum PpuFetchState {
    GetTile = 0,
    GetDataLo = 1,
    GetDataHi = 2,
    Sleep = 3,
    Push = 4
}

function log(s: string): void {
    Logger.Log("PPU: " + s);
}

// const PIXEL_FIFO_SIZE: u32 = 16;

@final
export class PpuTransfer {
    // static bgFifo: Fifo<u8> = new Fifo<u8>(PIXEL_FIFO_SIZE);

    static state: PpuFetchState = PpuFetchState.GetTile;
    static lineX: u8 = 0;
    private static fetcherX: u8 = 0;
    static pushedX: u8 = 0;
    static tileY: u8 = 0;
    static bgTileOffset: i16 = 0;
    static spriteCount: u8 = 0;

    private static readonly noSpriteIndices: Uint8Array = new Uint8Array(0);

    static fetchedBgBytes: u16 = 0;
    static numSpritesThisFetch: u8 = 0;
    static fetchedSpriteBytes: StaticArray<u16> = new StaticArray<u16>(3);

    static Init(): void {
        PixelFifo.Clear();
        PpuTransfer.state = PpuFetchState.GetTile;
        PpuTransfer.lineX = 0;
        PpuTransfer.fetcherX = 0;
        PpuTransfer.pushedX = 0;
        if (Logger.verbose >= 3) {
            log(`Mode 2 line ${Lcd.data.lY}, ${PpuOamFifo.size} sprites. First: ` + ((PpuOamFifo.size > 0) ? PpuOamFifo.Peek().tileIndex.toString() : 'none'))
        }
    }

    static Tick(): void {
        const lcd = Lcd.data;
        PpuTransfer.tileY = ((lcd.lY + lcd.scrollY) & 7) << 1;

        if ((Ppu.currentDot % 2) == 0) {
            PpuTransfer.TickFetcher();
        }
        PpuTransfer.tickPushPixel();
    }

    private static isInWindow(): boolean {
        const lcd = Lcd.data;
        return Lcd.IsWindowVisible
            && PpuTransfer.fetcherX + 7 >= lcd.windowX && PpuTransfer.fetcherX + 7 < lcd.windowX + LCD_WIDTH + 14;
    }

    private static TickFetcher(): void {
        const lcd = Lcd.data;
        switch (PpuTransfer.state) {
            case PpuFetchState.GetTile:
                PpuTransfer.spriteCount = 0;

                if (Lcd.BGandWindowVisible) {
                    const inWindow = PpuTransfer.isInWindow();
                    const mapBase = inWindow ? Lcd.WindowTileMapBaseAddress : Lcd.BgTileMapBaseAddress;
                    const mapX: u8 = inWindow ? PpuTransfer.fetcherX + 7 - lcd.windowX : PpuTransfer.fetcherX + (lcd.scrollX);
                    const mapY: u8 = inWindow ? Lcd.WindowLineY : lcd.lY + lcd.scrollY;

                    let dataIndex: u8 = load<u8>(mapBase + (mapX >> 3) + (<u16>(mapY >> 3) << 5));
                    const tileBaseIsLow = Lcd.data.hasControlBit(LcdControlBit.BGandWindowTileArea);
                    PpuTransfer.bgTileOffset = tileBaseIsLow ? <i16>dataIndex : <i16><u8>(dataIndex + 128);
                    if (Logger.verbose >= 4)
                        log(`currentDot: ${Ppu.currentDot}, fetcherX: ${PpuTransfer.fetcherX}, ly:${lcd.lY}, scroll:${lcd.scrollX},${lcd.scrollY}, map: ${mapX},${mapY}=>${(mapX >> 3) + (<u16>(mapY >> 3) << 5)}, tileIndex: ${dataIndex} (offset ${PpuTransfer.bgTileOffset}). tileY: ${PpuTransfer.tileY}`);
                }

                if (Lcd.SpritesVisible) {
                    PpuTransfer.numSpritesThisFetch = PpuOamFifo.GetSpriteIndicesFor(PpuTransfer.fetcherX);
                } else {
                    PpuTransfer.numSpritesThisFetch = 0;
                }
                PpuTransfer.FetchSpriteBytes();

                PpuTransfer.state = PpuFetchState.GetDataLo;
                PpuTransfer.fetcherX += 8;
                break;
            case PpuFetchState.GetDataLo:
                const tileByteAddress: u32 = Lcd.TilesBaseAddress + (PpuTransfer.bgTileOffset * 16) + PpuTransfer.tileY;
                if (tileByteAddress < GB_VIDEO_START || tileByteAddress >= (GB_VIDEO_START + GB_VIDEO_BANK_SIZE)) {
                    const error = `Invalid pointer: ${uToHex<u32>(tileByteAddress)} (GB ${uToHex<u32>(tileByteAddress - GB_VIDEO_START + 0x8000)})\n`
                        + `TilesBaseAddress = ${uToHex<u32>(Lcd.TilesBaseAddress)}, tileOffset = ${PpuTransfer.bgTileOffset}, *16 = ${(PpuTransfer.bgTileOffset * 16)}, tileY = ${PpuTransfer.tileY} \n`
                        + Cpu.GetTrace();
                    log(error)
                    console.log(error)
                    Cpu.isStopped = true;
                    return;
                }
                PpuTransfer.fetchedBgBytes = load<u16>(tileByteAddress);
                PpuTransfer.state = PpuFetchState.GetDataHi;
                break;
            case PpuFetchState.GetDataHi:
                PpuTransfer.state = PpuFetchState.Sleep;
                break;
            case PpuFetchState.Sleep:
                PpuTransfer.state = PpuFetchState.Push;
                break;
            case PpuFetchState.Push:
                if (!PixelFifo.HasEnoughPixels()) {
                    PpuTransfer.fetcherEnqueuePixel();
                    PpuTransfer.state = PpuFetchState.GetTile;
                }
                break;
            default:
                break;
        }
    }

    static FetchSpriteBytes(): void {
        if (Logger.verbose >= 3) {
            log(`FetchSpriteBytes() ${PpuTransfer.numSpritesThisFetch}`);
        }
        const ly = Lcd.data.lY;
        const spriteHeight = Lcd.SpriteHeight;
        for (let i = 0; i < <i32>PpuTransfer.numSpritesThisFetch; i++) {
            const oam = PpuOamFifo.Peek(i);

            let spriteY = (ly + 16 - oam.yPos);
            if (oam.hasAttr(OamAttribute.YFlip))
                spriteY = (spriteHeight - 1) - spriteY;

            const tileIndex: u16 = spriteHeight == 16 ? (oam.tileIndex & ~1) : oam.tileIndex;
            unchecked(PpuTransfer.fetchedSpriteBytes[i] = load<u16>(GB_VIDEO_START + (<u16>tileIndex * 16) + spriteY * 2));
            if (Logger.verbose >= 4) {
                log(`Fetched bytes from tileIndex ${tileIndex} Y: ${spriteY} => ${load<u8>(changetype<usize>(PpuTransfer.fetchedSpriteBytes) + i).toString(2).padStart(8, '0')} and ${load<u8>(changetype<usize>(PpuTransfer.fetchedSpriteBytes) + i + 1).toString(2).padStart(8, '0')}`)
            }
        }
    }

    private static fetcherEnqueuePixel(): void {
        const scrollOffset: i8 = <i8>(Lcd.data.scrollX & 7);
        const lcdStartX: i16 = PpuTransfer.fetcherX - scrollOffset;
        {
            const numSpritesToCheck: i32 = Lcd.SpritesVisible ? <i32>PpuTransfer.numSpritesThisFetch : 0;
            const BgPalette: u8 = Lcd.getBGPalette();
            for (let i: i16 = 0; i < 8; i++) {
                const lcdX: i16 = lcdStartX + <i16>i;
                if (Logger.verbose >= 4) {
                    log(`BG: i ${i}, lcdX ${lcdX}`)
                }
                if (lcdX < 0)
                    continue;
                const bgMask: u8 = (1 << <u8>(7 - i + scrollOffset));
                const bgColorId: u8 = Ppu.getColorIndexFromBytes(PpuTransfer.fetchedBgBytes, bgMask);
                let color = Ppu.applyPalette(Lcd.BGandWindowVisible ? bgColorId : 0, BgPalette);
                if (Logger.verbose >= 4) {
                    log(`BG pixel selected: mask ${bgMask.toString(2)}, colorId: ${bgColorId} with palette => ${color}`);
                }
                {
                    for (let j = 0; j < numSpritesToCheck; j++) {
                        const oam = PpuOamFifo.Peek(j);

                        if (oam.hasAttr(OamAttribute.BGandWindowOver) && bgColorId != 0)
                            continue;

                        const spriteX: i16 = <i16><u8>oam.xPos - 8;
                        const offset: i16 = spriteX - lcdX; // [-7, 0] if sprite is [x - 7, x]
                        if (Logger.verbose >= 4) {
                            log(`Fetching pixel ${PpuTransfer.fetcherX + i} on ${oam.tileIndex}: spriteX=${spriteX}, offset=${offset}`)
                        }
                        if (offset < -7 || offset > 0)
                            continue;

                        const bit: u8 = <u8>(oam.hasAttr(OamAttribute.XFlip) ? -offset : offset + 7); // [7-0] or [0-7] when flipped
                        assert((bit & 7) == bit);
                        const spriteBitMask: u8 = (1 << bit);
                        const spriteColorId = Ppu.getColorIndexFromBytes(unchecked(PpuTransfer.fetchedSpriteBytes[j]), spriteBitMask)
                        if (spriteColorId == 0)
                            continue;

                        const spritePalette = oam.hasAttr(OamAttribute.PaletteNumber) ? Lcd.data.objPalette1 : Lcd.data.objPalette0;
                        color = Ppu.applyPalette(spriteColorId, spritePalette & 0b11111100); // lower 2 bits of palette ignored for transparency
                        break;
                    }
                }
                PixelFifo.Enqueue(color);
            }
        }
    }

    private static tickPushPixel(): void {
        if (PixelFifo.HasEnoughPixels()) {
            if (PpuTransfer.lineX >= (Lcd.data.scrollX & 3)) {
                const bufferIndex = PpuTransfer.pushedX + Lcd.data.lY * LCD_WIDTH;
                if (bufferIndex >= <u32>(Ppu.workingBuffer.length)) {
                    if (Logger.verbose >= 1)
                        log(`OVERFLOW during tickPushPixel to [${bufferIndex}]! pushedX=${PpuTransfer.pushedX}, lY=${Lcd.data.lY}`);
                } else {
                    const color = PixelFifo.Dequeue();
                    const color32 = unchecked(Ppu.current32bitPalette[color]);
                    // const color = 0xFF000080 | ((<u32>(PpuTransfer.pushedX) * 255 / 160)) << 16 | ((<u32>(Lcd.data.lY) * 255 / 144)) << 8;
                    unchecked(Ppu.workingBuffer[PpuTransfer.pushedX + Lcd.data.lY * LCD_WIDTH] = color32);
                }
                PpuTransfer.pushedX++;
            }
            PpuTransfer.lineX++;
        }
    }

}
