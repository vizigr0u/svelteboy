import { GB_VIDEO_START } from "../../cpu/memoryMap";
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

@final
export class PpuTransfer {
    static fifo: Fifo<u32> = new Fifo<u32>();
    static state: PpuFetchState = PpuFetchState.GetTile;
    static lineX: u8 = 0;
    static Xfetching: u8 = 0;
    static pushedX: u8 = 0;
    static fifoX: u8 = 0;
    static mapX: u8 = 0;
    static mapY: u8 = 0;
    static tileY: u8 = 0;
    static fetchDataTmp: u8 = 0;
    static fetchDataLo: u8 = 0;
    static fetchDataHi: u8 = 0;


    static Init(): void {
        PpuTransfer.fifo.Reset();
        PpuTransfer.state = PpuFetchState.GetTile;
        PpuTransfer.lineX = 0;
        PpuTransfer.Xfetching = 0;
        PpuTransfer.pushedX = 0;
        PpuTransfer.fifoX = 0;
    }

    static Tick(): void {
        const lcd = Lcd.gbData();
        PpuTransfer.mapY = lcd.lY + lcd.scrollY;
        PpuTransfer.mapX = PpuTransfer.Xfetching + lcd.scrollX;
        PpuTransfer.tileY = ((lcd.lY + lcd.scrollY) & 3) << 1;

        if (Ppu.currentDot % 2 == 0) {
            tickFetcher();
        }
        tickPushPixel();
    }

    static Terminate(): void {
        PpuTransfer.fifo.Reset();
    }
}

function getBGMapAddress(): u32 {
    return GB_VIDEO_START + (Lcd.gbData().hasControlBit(LcdControlBit.BGTileMapArea) ? 0x1C00 : 0x1800);
}

function getBGDataAddress(): u32 {
    return GB_VIDEO_START + (Lcd.gbData().hasControlBit(LcdControlBit.BGandWindowTileArea) ? 0 : 0x800);
}

function tickFetcher(): void {
    switch (PpuTransfer.state) {
        case PpuFetchState.GetTile:
            if (Lcd.gbData().hasControlBit(LcdControlBit.BGandWindowEnabled)) {
                let dataIndex = load<u8>(getBGMapAddress() + PpuTransfer.mapX / 8 + (PpuTransfer.mapX / 8) * 32);
                if (!Lcd.gbData().hasControlBit(LcdControlBit.BGandWindowTileArea))
                    dataIndex += 128;
                PpuTransfer.fetchDataTmp = dataIndex;
            }
            PpuTransfer.state = PpuFetchState.GetDataLo;
            PpuTransfer.Xfetching += 8;
            break;
        case PpuFetchState.GetDataLo:
            PpuTransfer.fetchDataLo = load<u8>(getBGDataAddress() + PpuTransfer.fetchDataTmp * 16 + PpuTransfer.tileY);
            PpuTransfer.state = PpuFetchState.GetDataHi;
            break;
        case PpuFetchState.GetDataHi:
            PpuTransfer.fetchDataHi = load<u8>(getBGDataAddress() + PpuTransfer.fetchDataTmp * 16 + PpuTransfer.tileY + 1);
            PpuTransfer.state = PpuFetchState.Sleep;
            break;
        case PpuFetchState.Sleep:
            PpuTransfer.state = PpuFetchState.Push;
            break;
        case PpuFetchState.Push:
            if (PpuTransfer.fifo.length > 8) {
                pushPixel();
                PpuTransfer.state = PpuFetchState.Push;
            }
            break;
        default:
            break;
    }
}

function pushPixel(): void {
    const x = PpuTransfer.Xfetching - (8 - (Lcd.gbData().scrollX % 8));
    for (let i = 0; i < 8; i++) {
        const mask: u8 = (1 << <u8>(7 - i));
        const paletteId: u8 = (((PpuTransfer.fetchDataLo & mask) == mask) ? 1 : 0) | (((PpuTransfer.fetchDataHi & mask) == mask) ? 2 : 0);
        PpuTransfer.fifo.Enqueue(PaletteColors[paletteId]);
    }
}

function tickPushPixel(): void {
    if (PpuTransfer.fifo.length > 8) {
        const pixel = PpuTransfer.fifo.Dequeue();
        if (PpuTransfer.lineX >= (Lcd.gbData().scrollX & 3)) {
            Ppu.WorkingBuffer()[PpuTransfer.pushedX + Lcd.gbData().lY * LCD_WIDTH] = pixel;
            PpuTransfer.pushedX++;
        }
        PpuTransfer.lineX++;
    }
}