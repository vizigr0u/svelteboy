import { GB_VIDEO_START } from "../../cpu/memoryConstants";
import { Logger, log } from "../../debug/logger";
import { LCD_WIDTH, PaletteColors } from "./constants";
import { Fifo } from "./fifo";
import { Lcd, LcdControlBit } from "./lcd";
import { Ppu } from "./ppu";

enum PpuFetchState {
    GetTile = 0,
    GetDataLo = 1,
    GetDataHi = 2,
    Sleep = 3,
    Push = 4
}

const PIXEL_FIFO_SIZE: u32 = 16;

const MAP_BASE_LO: u32 = GB_VIDEO_START + <u32>0x1800;
const MAP_BASE_HI: u32 = GB_VIDEO_START + <u32>0x1C00;

const TILE_BASE_LO: u32 = GB_VIDEO_START;
const TILE_BASE_HI: u32 = GB_VIDEO_START + <u32>0x1000;

@final
export class PpuTransfer {
    static bgFifo: Fifo<u8> = new Fifo<u8>(PIXEL_FIFO_SIZE);
    static oamFifo: Fifo<u8> = new Fifo<u8>(PIXEL_FIFO_SIZE);
    static state: PpuFetchState = PpuFetchState.GetTile;
    static lineX: u8 = 0;
    static fetcherX: u8 = 0;
    static pushedX: u8 = 0;
    static tileY: u8 = 0;
    static bgTileOffset: i16 = 0;
    static fetchDataLo: u8 = 0;
    static fetchDataHi: u8 = 0;
    static spriteCount: u8 = 0;


    static Init(): void {
        PpuTransfer.bgFifo.Clear();
        PpuTransfer.oamFifo.Clear();
        PpuTransfer.state = PpuFetchState.GetTile;
        PpuTransfer.lineX = 0;
        PpuTransfer.fetcherX = 0;
        PpuTransfer.pushedX = 0;
    }

    static Tick(): void {
        const lcd = Lcd.gbData();
        PpuTransfer.tileY = ((lcd.lY + lcd.scrollY) & 7) << 1;

        if ((Ppu.currentDot % 2) == 0) {
            tickFetcher();
        }
        tickPushPixel();
    }
}

function getBGDataAddress(): u32 {
    return Lcd.gbData().hasControlBit(LcdControlBit.BGandWindowTileArea) ? TILE_BASE_LO : TILE_BASE_HI;
}

function tickFetcher(): void {
    const lcd = Lcd.gbData();
    switch (PpuTransfer.state) {
        case PpuFetchState.GetTile:
            PpuTransfer.spriteCount = 0;

            if (lcd.hasControlBit(LcdControlBit.BGandWindowEnabled)) {
                const mapX: u8 = PpuTransfer.fetcherX + (lcd.scrollX);
                const mapY: u8 = (lcd.lY + lcd.scrollY);
                let mapBase = MAP_BASE_LO;
                const isInWindow = PpuTransfer.fetcherX + 7 >= lcd.windowX && lcd.lY >= lcd.windowY;
                if (lcd.hasControlBit(LcdControlBit.BGTileMapArea) && !isInWindow ||
                    lcd.hasControlBit(LcdControlBit.WindowTileMapArea) && isInWindow)
                    mapBase = MAP_BASE_HI;

                let dataIndex = load<u8>(mapBase + (mapX >> 3) + (<u16>(mapY >> 3) << 5));
                const tileBaseIsLow = Lcd.gbData().hasControlBit(LcdControlBit.BGandWindowTileArea);
                PpuTransfer.bgTileOffset = tileBaseIsLow ? <i16><u8>dataIndex : <i16><i8>dataIndex;
                if (Logger.verbose >= 4)
                    log(`currentDot: ${Ppu.currentDot}, fetcherX: ${PpuTransfer.fetcherX}, ly:${lcd.lY}, scroll:${lcd.scrollX},${lcd.scrollY}, map: ${mapX},${mapY}=>${(mapX >> 3) + (<u16>(mapY >> 3) << 5)}, tileIndex: ${dataIndex} (offset ${PpuTransfer.bgTileOffset}). tileY: ${PpuTransfer.tileY}`);
            }

            if (lcd.hasControlBit(LcdControlBit.ObjEnabled)) {
                // TODO get sprite in spriteFifo
            }

            PpuTransfer.state = PpuFetchState.GetDataLo;
            PpuTransfer.fetcherX += 8;
            break;
        case PpuFetchState.GetDataLo:
            PpuTransfer.fetchDataLo = load<u8>(getBGDataAddress() + <u32>(PpuTransfer.bgTileOffset * 16) + PpuTransfer.tileY);
            PpuTransfer.state = PpuFetchState.GetDataHi;
            break;
        case PpuFetchState.GetDataHi:
            PpuTransfer.fetchDataHi = load<u8>(getBGDataAddress() + <u32>(PpuTransfer.bgTileOffset * 16) + PpuTransfer.tileY + 1);
            PpuTransfer.state = PpuFetchState.Sleep;
            break;
        case PpuFetchState.Sleep:
            PpuTransfer.state = PpuFetchState.Push;
            break;
        case PpuFetchState.Push:
            if (PpuTransfer.bgFifo.length <= 8) {
                fetcherEnqueuePixel();
                PpuTransfer.state = PpuFetchState.GetTile;
            }
            break;
        default:
            break;
    }
}

function fetcherEnqueuePixel(): void {
    const x = PpuTransfer.fetcherX - (8 - (Lcd.gbData().scrollX % 8));
    if (x >= 0) {
        for (let i = 0; i < 8; i++) {
            const mask: u8 = (1 << <u8>(7 - i));
            const bgColorId: u8 = (((PpuTransfer.fetchDataLo & mask) == mask) ? 1 : 0) | (((PpuTransfer.fetchDataHi & mask) == mask) ? 2 : 0);
            let colorId = Lcd.gbData().hasControlBit(LcdControlBit.BGandWindowEnabled) ? bgColorId : 0;
            // TODO add sprite pixel
            PpuTransfer.bgFifo.Enqueue(colorId);
        }
    }
}

function tickPushPixel(): void {
    if (PpuTransfer.bgFifo.length >= 8) {
        if (PpuTransfer.lineX >= (Lcd.gbData().scrollX & 3)) {
            const bufferIndex = PpuTransfer.pushedX + Lcd.gbData().lY * LCD_WIDTH;
            if (bufferIndex >= <u32>(Ppu.workingBuffer.length)) {
                if (Logger.verbose >= 1)
                    log(`OVERFLOW during tickPushPixel to [${bufferIndex}]! pushedX=${PpuTransfer.pushedX}, lY=${Lcd.gbData().lY}`);
            } else {
                const paletteId = PpuTransfer.bgFifo.Dequeue();
                const palette: u8 = Lcd.getBGPalette();
                const colorId: u8 = (palette >> (paletteId << 1)) & 0b11;
                const color = PaletteColors[colorId];
                // const color = 0xFF000080 | ((<u32>(PpuTransfer.pushedX) * 255 / 160)) << 16 | ((<u32>(Lcd.gbData().lY) * 255 / 144)) << 8;
                Ppu.workingBuffer[PpuTransfer.pushedX + Lcd.gbData().lY * LCD_WIDTH] = color;
            }
            PpuTransfer.pushedX++;
        }
        PpuTransfer.lineX++;
    }
}
