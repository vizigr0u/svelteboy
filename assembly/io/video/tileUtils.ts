import { GB_OAM_START, GB_VIDEO_START } from '../../memory/memoryConstants';
import { LCD_HEIGHT, LCD_WIDTH } from './constants';
import { Lcd, LcdControlBit } from './lcd';
import { MAX_OAM_COUNT, OamData } from './oam';
import { Ppu } from './ppu';

const gbTileData: u8[] = [0x3C, 0x7E, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x7E, 0x5E, 0x7E, 0x0A, 0x7C, 0x56, 0x38, 0x7C];
const pokemonWindowTileData: u8[] = [0xFF, 0x00, 0x7E, 0xFF, 0x85, 0x81, 0x89, 0x83, 0x93, 0x85, 0xA5, 0x8B, 0xC9, 0x97, 0x7E, 0xFF];

export function blitTile(dest: Uint32Array, tileAddress: usize, bufferWidth: u32, xOffset: u32 = 0, yOffset: u32 = 0): void {
    for (let tileY: u32 = 0; tileY < 8; tileY++) {
        const lowByte = load<u8>(tileAddress + tileY * 2);
        const highByte = load<u8>(tileAddress + tileY * 2 + 1);
        for (let tileX: u32 = 0; tileX < 8; tileX++) {
            const mask: u8 = 1 << <u8>(7 - tileX);
            const paletteId: u8 = (((lowByte & mask) == mask) ? 1 : 0) | (((highByte & mask) == mask) ? 2 : 0);
            assert(paletteId < 4, 'Unexpected palette id: ' + paletteId.toString());
            const palette: u8 = Lcd.getBGPalette();
            const colorId: u8 = (palette >> (paletteId << 1)) & 0b11;
            // console.log(`[${x}, ${y}] 0b${mask.toString(2)} - dark: 0b${darkByte.toString(2)}, light: 0b${lightByte.toString(2)} = ${color}`);
            const finalX = tileX + xOffset;
            const finalY = tileY + yOffset;
            const bufferIndex = (finalX + finalY * bufferWidth);
            dest[bufferIndex] = Ppu.current32bitPalette[colorId];
        }
    }
}

export function tileToRgba(tile: Uint8Array): Uint8ClampedArray {
    const res = new Uint8ClampedArray(8 * 8 * 4);
    blitTile(Uint32Array.wrap(res.buffer), tile.dataStart, 8);
    return res;
}

export function drawTileData(screenBuffer: Uint8ClampedArray, bufferWidth: u32): Uint8ClampedArray {
    assert(screenBuffer != null && screenBuffer.buffer != null, 'Screenbuffer is null')
    assert(screenBuffer.byteLength >= 3 * 128 * 4, 'Insufficient buffer size to blit all tiles');
    const buffer = Uint32Array.wrap(screenBuffer.buffer);
    const numTilesX: u16 = <u16>(bufferWidth / 8);
    const numTilesY: u16 = <u16>((3 * 128) / numTilesX);
    // let tileBuffer: Uint8Array = new Uint8Array(16);
    for (let y: u16 = 0; y < numTilesY; y++) {
        for (let x: u16 = 0; x < numTilesX; x++) {
            const tileIndex = x + y * numTilesX;
            const dataStart = GB_VIDEO_START + <u16>(tileIndex * 16);
            blitTile(buffer, dataStart, bufferWidth, x * 8, y * 8);
        }
    }
    return screenBuffer;
}

export function getBGTileMap(buffer: Uint8Array): Uint8Array {
    assert(buffer.byteLength == 32 * 32);
    const bufferSize: u16 = 32;
    const numTilesX: u16 = bufferSize;
    const numTilesY: u16 = bufferSize;

    const mapOnHighAddress = Lcd.data.hasControlBit(LcdControlBit.BGTileMapArea);
    const tileMapAddress: u32 = GB_VIDEO_START + (mapOnHighAddress ? 0x1C00 : 0x1800);

    for (let y: u16 = 0; y < numTilesY; y++) {
        for (let x: u16 = 0; x < numTilesX; x++) {
            const tileMapIndex: u16 = x + y * numTilesX;
            const tileIndexAddress: u32 = tileMapAddress + tileMapIndex;
            buffer[tileMapIndex] = load<u8>(tileIndexAddress);
        }
    }
    return buffer;
}

export function getOAMTiles(buffer: Uint32Array): Uint32Array {
    const byteLength = MAX_OAM_COUNT * offsetof<OamData>();
    // console.log(uToHex<usize>(buffer.dataStart))
    assert(buffer != null && buffer.buffer != null, 'OAM is null')
    assert(buffer.byteLength == byteLength, 'getOAMTiles: Buffer size not matching');
    memory.copy(buffer.dataStart, GB_OAM_START, byteLength);
    return buffer;
}

export function drawBackgroundMap(screenBuffer: Uint8ClampedArray): Uint8ClampedArray {
    const buffer = Uint32Array.wrap(screenBuffer.buffer);
    assert(buffer.byteLength == 32 * 32 * 8 * 8 * 4); // 32*32 tiles of 8*8 pixels of 4 bytes
    const bufferSize: u16 = 32;
    const numTilesX: u16 = bufferSize;
    const numTilesY: u16 = bufferSize;
    const tilesOnLowAddress = Lcd.data.hasControlBit(LcdControlBit.BGandWindowTileArea);
    const tileDataBaseAddress: u32 = GB_VIDEO_START + (tilesOnLowAddress ? 0 : 0x1000);
    const mapOnHighAddress = Lcd.data.hasControlBit(LcdControlBit.BGTileMapArea);
    const tileMapAddress: u32 = GB_VIDEO_START + (mapOnHighAddress ? 0x1C00 : 0x1800);
    // let tileBuffer: Uint8Array = new Uint8Array(16);
    for (let y: u16 = 0; y < numTilesY; y++) {
        for (let x: u16 = 0; x < numTilesX; x++) {
            const tileMapIndex: u16 = x + y * numTilesX;
            const tileIndexAddress: u32 = tileMapAddress + tileMapIndex;
            const tileIndex = load<u8>(tileIndexAddress);
            const tileOffset: i16 = tilesOnLowAddress ? <i16><u8>tileIndex : <i16><i8>tileIndex;
            const dataStart: u32 = tileDataBaseAddress + tileOffset * 16;
            // log(`mapIndex: ${tileMapIndex}, indexAddress ${uToHex<u32>(tileIndexAddress)} (${uToHex<u16>(<u16>(tileIndexAddress - GB_VIDEO_START + 0x8000))}), index: ${tileIndex}, tileAddress: ${uToHex<u32>(dataStart)} (${uToHex<u16>(<u16>(0x8000 + <u16>(tileIndex * 16)))})`)
            blitTile(buffer, dataStart, numTilesX * 8, x * 8, y * 8);
        }
    }
    return screenBuffer;
}

export function getTestExampleData(screenBuffer: Uint8ClampedArray, bufferWidth: u32): Uint8ClampedArray {
    memory.fill(screenBuffer.dataStart, 0x80, screenBuffer.byteLength);
    blitTile(Uint32Array.wrap(screenBuffer.buffer), changetype<Uint8Array>(pokemonWindowTileData).dataStart, bufferWidth, (LCD_WIDTH - 16) / 2, (LCD_HEIGHT - 16) / 2);
    return screenBuffer;
}

export function getGameboyTileExampleData(): Uint8ClampedArray {
    return tileToRgba(changetype<Uint8Array>(gbTileData));
}