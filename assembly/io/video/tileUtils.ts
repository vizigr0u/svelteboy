import { GB_VIDEO_START } from '../../cpu/memoryMap';
import { LCD_HEIGHT, LCD_WIDTH, Lcd, LcdControlBit } from './lcd';

const colors: u8[][] = [
    [224, 248, 208, 255],
    [136, 192, 112, 255],
    [52, 104, 86, 255],
    [0, 0, 0, 255]
];

const gbTileData: u8[] = [0x3C, 0x7E, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x7E, 0x5E, 0x7E, 0x0A, 0x7C, 0x56, 0x38, 0x7C];
const pokemonWindowTileData: u8[] = [0xFF, 0x00, 0x7E, 0xFF, 0x85, 0x81, 0x89, 0x83, 0x93, 0x85, 0xA5, 0x8B, 0xC9, 0x97, 0x7E, 0xFF];
const letterATileData: u8[] = [0x7C, 0x7C, 0x00, 0xC6, 0xC6, 0x00, 0x00, 0xFE, 0xC6, 0xC6, 0x00, 0xC6, 0xC6, 0x00, 0x00, 0x00];

export function blitTile(dest: Uint8Array, tileAddress: usize, bufferWidth: u32, xOffset: u32 = 0, yOffset: u32 = 0): void {
    for (let i: u32 = 0; i < 64; i++) {
        const tileX: u8 = <u8>(i % 8);
        const tileY: u8 = <u8>(i / 8);
        const lowByte = load<u8>(tileAddress + tileY * 2);
        const highByte = load<u8>(tileAddress + tileY * 2 + 1);
        const mask: u8 = 1 << (7 - tileX);
        const paletteId: u8 = (((lowByte & mask) == mask) ? 1 : 0) | (((highByte & mask) == mask) ? 2 : 0);
        assert(paletteId < 4, 'Unexpected palette id: ' + paletteId.toString());
        const palette: u8 = Lcd.getBGPalette();
        const colorId: u8 = (palette >> (paletteId << 1)) & 0b11;
        // console.log(`[${x}, ${y}] 0b${mask.toString(2)} - dark: 0b${darkByte.toString(2)}, light: 0b${lightByte.toString(2)} = ${color}`);
        const finalX = tileX + xOffset;
        const finalY = tileY + yOffset;
        const bufferIndex = (finalX + finalY * bufferWidth) << 2;
        dest[bufferIndex] = colors[colorId][0]; // R
        dest[bufferIndex + 1] = colors[colorId][1]; // G
        dest[bufferIndex + 2] = colors[colorId][2]; // B
        dest[bufferIndex + 3] = colors[colorId][3]; // A
    }
}

export function tileToRgba(tile: Uint8Array): Uint8ClampedArray {
    const res = new Uint8ClampedArray(8 * 8 * 4);
    blitTile(Uint8Array.wrap(res.buffer), tile.dataStart, 8);
    return res;
}

export function drawTileData(screenBuffer: Uint8ClampedArray, bufferWidth: u32): Uint8ClampedArray {
    const buffer = Uint8Array.wrap(screenBuffer.buffer);
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

export function drawBackgroundMap(screenBuffer: Uint8ClampedArray): Uint8ClampedArray {
    const buffer = Uint8Array.wrap(screenBuffer.buffer);
    assert(buffer.byteLength == 32 * 32 * 8 * 8 * 4); // 32*32 tiles of 8*8 pixels of 4 bytes
    const bufferSize: u16 = 32;
    const numTilesX: u16 = bufferSize;
    const numTilesY: u16 = bufferSize;
    const tilesOnLowAddress = !Lcd.gbData().hasControlBit(LcdControlBit.BGandWindowTileArea); // TODO inverted
    const tileDataAddress: u32 = GB_VIDEO_START + (tilesOnLowAddress ? 0 : 0x800);
    const mapOnHighAddress = Lcd.gbData().hasControlBit(LcdControlBit.BGTileMapArea);
    const tileMapAddress: u32 = GB_VIDEO_START + (mapOnHighAddress ? 0x1C00 : 0x1800);
    // let tileBuffer: Uint8Array = new Uint8Array(16);
    for (let y: u16 = 0; y < numTilesY; y++) {
        for (let x: u16 = 0; x < numTilesX; x++) {
            const tileMapIndex: u16 = x + y * numTilesX;
            const tileAddress = tileMapAddress + tileMapIndex;
            const tileIndex = load<u8>(tileAddress);
            const dataStart = tileDataAddress + <u16>(tileIndex * 16);
            blitTile(buffer, dataStart, numTilesX * 8, x * 8, y * 8);
        }
    }
    return screenBuffer;
}

export function getTestExampleData(screenBuffer: Uint8ClampedArray, bufferWidth: u32): Uint8ClampedArray {
    memory.fill(screenBuffer.dataStart, 0x80, screenBuffer.byteLength);
    blitTile(Uint8Array.wrap(screenBuffer.buffer), changetype<Uint8Array>(pokemonWindowTileData).dataStart, bufferWidth, (LCD_WIDTH - 16) / 2, (LCD_HEIGHT - 16) / 2);
    return screenBuffer;
}

export function getGameboyTileExampleData(): Uint8ClampedArray {
    return tileToRgba(changetype<Uint8Array>(gbTileData));
}

export function getPokemonTileExampleData(): Uint8ClampedArray {
    return tileToRgba(changetype<Uint8Array>(pokemonWindowTileData));
}

export function getLetterTileExampleData(): Uint8ClampedArray {
    return tileToRgba(changetype<Uint8Array>(letterATileData));
}
