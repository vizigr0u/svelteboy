import { GB_VIDEO_START } from "../../cpu/memoryConstants";
import { log } from "../../debug/logger";
import { uToHex } from "../../utils/stringUtils";
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
    static bgTileIndex: u8 = 0;
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
        PpuTransfer.tileY = ((lcd.lY + lcd.scrollY) & 3) << 1;

        if (Ppu.currentDot % 2 == 0) {
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
                const mapX = (PpuTransfer.fetcherX + (lcd.scrollX >> 3)) & 0x1F;
                const mapY = <u8>(lcd.lY + lcd.scrollY);
                let mapBase = MAP_BASE_LO;
                const isInWindow = PpuTransfer.fetcherX >= lcd.windowX + 7 && lcd.lY >= lcd.windowY;
                if (lcd.hasControlBit(LcdControlBit.BGTileMapArea) && !isInWindow ||
                    lcd.hasControlBit(LcdControlBit.WindowTileMapArea) && isInWindow)
                    mapBase = MAP_BASE_HI;

                let dataIndex = load<u8>(mapBase + (mapX >> 3) + ((mapY >> 3) << 5));
                if (!lcd.hasControlBit(LcdControlBit.BGandWindowTileArea))
                    dataIndex += 128;

                PpuTransfer.bgTileIndex = dataIndex;
            }

            if (lcd.hasControlBit(LcdControlBit.ObjEnabled)) {
                // TODO get sprite in spriteFifo
            }

            PpuTransfer.state = PpuFetchState.GetDataLo;
            PpuTransfer.fetcherX += 8;
            break;
        case PpuFetchState.GetDataLo:
            PpuTransfer.fetchDataLo = load<u8>(getBGDataAddress() + PpuTransfer.bgTileIndex * 16 + PpuTransfer.tileY);
            PpuTransfer.state = PpuFetchState.GetDataHi;
            break;
        case PpuFetchState.GetDataHi:
            PpuTransfer.fetchDataHi = load<u8>(getBGDataAddress() + PpuTransfer.bgTileIndex * 16 + PpuTransfer.tileY + 1);
            PpuTransfer.state = PpuFetchState.Sleep;
            break;
        case PpuFetchState.Sleep:
            PpuTransfer.state = PpuFetchState.Push;
            break;
        case PpuFetchState.Push:
            if (PpuTransfer.bgFifo.length <= 8) {
                fetcherEnqueuePixel();
                PpuTransfer.state = PpuFetchState.Push;
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
            const colorId: u8 = (((PpuTransfer.fetchDataLo & mask) == mask) ? 1 : 0) | (((PpuTransfer.fetchDataHi & mask) == mask) ? 2 : 0);
            PpuTransfer.bgFifo.Enqueue(colorId);
        }
    }
}

function tickPushPixel(): void {
    if (PpuTransfer.bgFifo.length >= 8) {
        if (PpuTransfer.lineX >= (Lcd.gbData().scrollX & 3)) {
            const colorId = PpuTransfer.bgFifo.Dequeue();
            // const color: u32 = PaletteColors[0];
            log(`[${uToHex<u32>(PpuTransfer.pushedX + Lcd.gbData().lY * LCD_WIDTH)}] <= ${colorId}`);
            // Ppu.WorkingBuffer()[PpuTransfer.pushedX + Lcd.gbData().lY * LCD_WIDTH] = 0xFF553344;
            // Ppu.WorkingBuffer()[PpuTransfer.pushedX + Lcd.gbData().lY * LCD_WIDTH] = color;
            PpuTransfer.pushedX++;
        }
        PpuTransfer.lineX++;
    }
}