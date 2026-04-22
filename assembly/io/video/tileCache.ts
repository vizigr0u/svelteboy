import { GB_VIDEO_START } from "../../memory/memoryConstants";

// Pre-decoded tile pixel colors.
// Layout: tileIdx * 64 + row * 8 + col  (col 0 = leftmost = bit 7)
// 384 tiles × 8 rows × 8 pixels = 24576 bytes
export class TileCache {
    static data: StaticArray<u8> = new StaticArray<u8>(24576);

    static Init(): void {
        // Zero the cache on emulator reset (VRAM is also zeroed)
        for (let i = 0; i < 24576; i++) unchecked(TileCache.data[i] = 0);
    }

    static RebuildAll(): void {
        for (let addr: u16 = 0x8000; addr < 0x9800; addr += 2) {
            TileCache.decode(addr);
        }
    }

    @inline
    static decode(gbAddress: u16): void {
        // Only tile data area 0x8000–0x97FF
        if (gbAddress >= 0x9800) return;
        const vramOffset: u32 = gbAddress - 0x8000;
        const rowOffset: u32 = vramOffset & ~1; // normalize to lo byte
        const tileIdx: u32 = rowOffset >> 4;
        const row: u32 = (rowOffset >> 1) & 7;
        const lo: u8 = load<u8>(GB_VIDEO_START + rowOffset);
        const hi: u8 = load<u8>(GB_VIDEO_START + rowOffset + 1);
        const base: u32 = (tileIdx * 8 + row) << 3;
        for (let col: u32 = 0; col < 8; col++) {
            const bit: u8 = <u8>(7 - col);
            unchecked(TileCache.data[base + col] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1));
        }
    }
}
