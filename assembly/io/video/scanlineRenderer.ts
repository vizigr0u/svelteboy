import { Cpu } from "../../cpu/cpu";
import { GB_VIDEO_BANK_SIZE, GB_VIDEO_START } from "../../memory/memoryConstants";
import { Logger } from "../../debug/logger";
import { LCD_WIDTH } from "./constants";
import { Lcd, LcdControlBit } from "./lcd";
import { OamAttribute } from "./oam";
import { Ppu, PpuOamFifo } from "./ppu";
import { uToHex } from "../../utils/stringUtils";
import { perfNow } from "../../debug/perfMarks";

function log(s: string): void {
    Logger.Log("PPU-scanline: " + s);
}

@final
export class ScanlineRenderer {
    private static pixels: StaticArray<u8> = new StaticArray<u8>(LCD_WIDTH);

    // Precomputed per-scanline sprite data (indexed by FIFO position 0..9)
    private static spriteXPos: StaticArray<u8> = new StaticArray<u8>(10);
    // Decoded pixel colors by pixel offset [0..7] from sprite left edge (xFlip already applied)
    private static spritePixels: StaticArray<u8> = new StaticArray<u8>(80); // 10 * 8
    private static spritePalette: StaticArray<u8> = new StaticArray<u8>(10);
    private static spriteBgPrio: StaticArray<u8> = new StaticArray<u8>(10);

    static bgTotalTicks: f64 = 0;
    static spriteTotalTicks: f64 = 0;
    static compositeTotalTicks: f64 = 0;

    static Init(): void {
        // @ts-ignore
        if (isDefined(INSTRUMENTED))
        {
            ScanlineRenderer.bgTotalTicks = 0;
            ScanlineRenderer.spriteTotalTicks = 0;
            ScanlineRenderer.compositeTotalTicks = 0;
        }
    }

    static Tick(): void {
    }

    @inline
    private static isInWindow(x: u8, winX: u16): boolean {
        return x + 7 >= winX && x + 7 < winX + LCD_WIDTH + 14;
    }

    static Render(): void {
        let t0: f64 = 0, t1: f64 = 0, t2: f64 = 0;
        // @ts-ignore
        if (isDefined(INSTRUMENTED)) t0 = perfNow();
        const pixels = ScanlineRenderer.pixels;
        const lcd = Lcd.data;
        const y = lcd.lY;
        const bgTileY  = ((lcd.lY + lcd.scrollY) & 7) << 1;
        const winTileY = (Lcd.WindowLineY & 7) << 1;

        const winX = lcd.windowX;
        const winVisible = Lcd.IsWindowVisible;
        const BgPalette: u8 = Lcd.getBGPalette();
        const bgEnabled = Lcd.BGandWindowVisible;

        // --- BG and window rendering ---
        if (bgEnabled) {
            const tileBaseIsLow = Lcd.data.hasControlBit(LcdControlBit.BGandWindowTileArea);
            const offset: u8 = lcd.scrollX & 7;

            if (!winVisible) {
                // Fast path: no window active
                for (let x: u8 = 0; x < LCD_WIDTH;) {
                    const mapX: u8 = x + lcd.scrollX;
                    const mapY: u8 = lcd.lY + lcd.scrollY;
                    const dataIndex: u8 = load<u8>(Lcd.BgTileMapBaseAddress + (mapX >> 3) + (<u16>(mapY >> 3) << 5));
                    const bgTileOffset: i16 = tileBaseIsLow ? <i16>dataIndex : <i16><u8>(dataIndex + 128);
                    const tileByteAddress: u32 = Lcd.TilesBaseAddress + (bgTileOffset * 16) + bgTileY;
                    if (Logger.verbose >= 1) {
                        if (tileByteAddress < GB_VIDEO_START || tileByteAddress >= (GB_VIDEO_START + GB_VIDEO_BANK_SIZE)) {
                            const error = `Invalid pointer: ${uToHex<u32>(tileByteAddress)} (GB ${uToHex<u32>(tileByteAddress - GB_VIDEO_START + 0x8000)})\n`
                                + `TilesBaseAddress = ${uToHex<u32>(Lcd.TilesBaseAddress)}, tileOffset = ${bgTileOffset}, *16 = ${(bgTileOffset * 16)}, tileY = ${bgTileY} \n`
                                + Cpu.GetTrace();
                            log(error);
                            console.log(error);
                            assert(false, error);
                            return;
                        }
                    }
                    const fetchedBgBytes = load<u16>(tileByteAddress);
                    const lo: u8 = <u8>fetchedBgBytes;
                    const hi: u8 = <u8>(fetchedBgBytes >> 8);
                    const startI: i16 = x == 0 ? offset : 0;
                    const endI: i16 = x + 8 > LCD_WIDTH ? offset : 8;
                    for (let i = startI; i < endI; i++) {
                        const bit: u8 = <u8>(7 - i);
                        unchecked(pixels[x++] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1));
                    }
                }
            } else {
                // Slow path: window may be active
                for (let x: u8 = 0; x < LCD_WIDTH;) {
                    const inWindow = ScanlineRenderer.isInWindow(x, winX);
                    const mapBase = inWindow ? Lcd.WindowTileMapBaseAddress : Lcd.BgTileMapBaseAddress;
                    const mapX: u8 = inWindow ? x + 7 - lcd.windowX : x + lcd.scrollX;
                    const mapY: u8 = inWindow ? Lcd.WindowLineY : lcd.lY + lcd.scrollY;
                    const tileY = inWindow ? winTileY : bgTileY;
                    const dataIndex: u8 = load<u8>(mapBase + (mapX >> 3) + (<u16>(mapY >> 3) << 5));
                    const bgTileOffset: i16 = tileBaseIsLow ? <i16>dataIndex : <i16><u8>(dataIndex + 128);
                    const tileByteAddress: u32 = Lcd.TilesBaseAddress + (bgTileOffset * 16) + tileY;
                    if (Logger.verbose >= 1) {
                        if (tileByteAddress < GB_VIDEO_START || tileByteAddress >= (GB_VIDEO_START + GB_VIDEO_BANK_SIZE)) {
                            const error = `Invalid pointer: ${uToHex<u32>(tileByteAddress)} (GB ${uToHex<u32>(tileByteAddress - GB_VIDEO_START + 0x8000)})\n`
                                + `TilesBaseAddress = ${uToHex<u32>(Lcd.TilesBaseAddress)}, tileOffset = ${bgTileOffset}, *16 = ${(bgTileOffset * 16)}, tileY = ${tileY} \n`
                                + Cpu.GetTrace();
                            log(error);
                            console.log(error);
                            assert(false, error);
                            return;
                        }
                    }
                    const fetchedBgBytes = load<u16>(tileByteAddress);
                    const lo: u8 = <u8>fetchedBgBytes;
                    const hi: u8 = <u8>(fetchedBgBytes >> 8);
                    const startI: i16 = !inWindow && x == 0 ? offset : 0;
                    const endI: i16 = !inWindow && x + 8 > LCD_WIDTH ? offset : 8;
                    for (let i = startI; i < endI; i++) {
                        const bit: u8 = <u8>(7 - i);
                        unchecked(pixels[x++] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1));
                    }
                }
            }
        }

        // --- Pre-decode sprite rows (once per scanline) ---
        // @ts-ignore
        if (isDefined(INSTRUMENTED)) { t1 = perfNow(); ScanlineRenderer.bgTotalTicks += t1 - t0; }
        const spritesVisible = Lcd.SpritesVisible;
        let numSprites: i32 = 0;
        if (spritesVisible) {
            const spriteHeight = Lcd.SpriteHeight;
            numSprites = PpuOamFifo.size;
            for (let fi: i32 = 0; fi < numSprites; fi++) {
                const oam = PpuOamFifo.Peek(fi);
                let spriteY = (y + 16 - oam.yPos);
                if (oam.hasAttr(OamAttribute.YFlip))
                    spriteY = (spriteHeight - 1) - spriteY;
                const tileIndex: u16 = spriteHeight == 16 ? (oam.tileIndex & ~1) : oam.tileIndex;
                const spriteBytes: u16 = load<u16>(GB_VIDEO_START + (<u16>tileIndex * 16) + spriteY * 2);
                const lo: u8 = <u8>spriteBytes;
                const hi: u8 = <u8>(spriteBytes >> 8);
                const xFlip = oam.hasAttr(OamAttribute.XFlip);
                const base = fi * 8;
                for (let pixOff: u8 = 0; pixOff < 8; pixOff++) {
                    // pixOff=0 is leftmost pixel of sprite; map to raw bit (with xFlip)
                    const bit: u8 = xFlip ? pixOff : (7 - pixOff);
                    unchecked(ScanlineRenderer.spritePixels[base + pixOff] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1));
                }
                unchecked(ScanlineRenderer.spriteXPos[fi] = oam.xPos);
                const pal = oam.hasAttr(OamAttribute.PaletteNumber) ? Lcd.data.objPalette1 : Lcd.data.objPalette0;
                unchecked(ScanlineRenderer.spritePalette[fi] = pal & 0b11111100);
                unchecked(ScanlineRenderer.spriteBgPrio[fi] = oam.hasAttr(OamAttribute.BGandWindowOver) ? 1 : 0);
            }
        }

        // --- Composite: sprites + palette + 32-bit output (single pass) ---
        // @ts-ignore
        if (isDefined(INSTRUMENTED)) { t2 = perfNow(); ScanlineRenderer.spriteTotalTicks += t2 - t1; }
        const bufferOffset = y * LCD_WIDTH;
        const palette32 = Ppu.current32bitPalette;
        const workingBufferPtr = Ppu.workingBuffer.dataStart;
        let spriteHead: i32 = 0;

        for (let x: u8 = 0; x < LCD_WIDTH; x++) {
            const bgColorId = unchecked(pixels[x]);
            let color: u8 = Ppu.applyPalette(bgEnabled ? bgColorId : 0, BgPalette);

            if (numSprites > 0) {
                // Advance past sprites that end before x (original: xPos < x)
                while (spriteHead < numSprites &&
                       unchecked(ScanlineRenderer.spriteXPos[spriteHead]) < x)
                    spriteHead++;

                let validCount: i32 = 0;
                for (let si = spriteHead; validCount < 3 && si < numSprites; si++) {
                    const spriteXPos = unchecked(ScanlineRenderer.spriteXPos[si]);
                    const spriteX: i16 = <i16>spriteXPos - 8;

                    // Early exit: sorted by xPos, no further sprite can overlap
                    if (spriteX >= <i16>x + 8) break;

                    // Overlap check (preserves original GetSpriteIndicesFor semantics)
                    const overlaps = (spriteX >= <i16>x && spriteX < <i16>x + 8)
                        || (spriteX < <i16>x && spriteX + 8 >= <i16>x);
                    if (!overlaps) continue;

                    validCount++;

                    // Render filter: only pixels where sprite actually covers x
                    const offset: i16 = spriteX - x; // [-7, 0] for renderable overlap
                    if (offset < -7 || offset > 0) continue;

                    if (unchecked(ScanlineRenderer.spriteBgPrio[si]) && bgColorId != 0) continue;

                    const pixOff: u8 = <u8>(-offset); // [0, 7]
                    const spriteColorId = unchecked(ScanlineRenderer.spritePixels[si * 8 + pixOff]);
                    if (spriteColorId != 0) {
                        color = Ppu.applyPalette(spriteColorId, unchecked(ScanlineRenderer.spritePalette[si]));
                        break;
                    }
                }
            }

            store<u32>(workingBufferPtr + (<u32>(x + bufferOffset) << 2), unchecked(palette32[color]));
        }
        // @ts-ignore
        if (isDefined(INSTRUMENTED)) ScanlineRenderer.compositeTotalTicks += perfNow() - t2;
    }

    static RenderDiag(): void {
        // @ts-ignore
        if (!isDefined(INSTRUMENTED)) {
            console.warn("!INSTRUMENTED - use 'instrumented' target");
            return;
        }
        const bg = ScanlineRenderer.bgTotalTicks;
        const sprite = ScanlineRenderer.spriteTotalTicks;
        const composite = ScanlineRenderer.compositeTotalTicks;
        const total = bg + sprite + composite;
        console.log(`ScanlineRenderer diag:`
            + `\n  bg:        ${<i64>(bg * 1000)}us (${<i32>(bg / total * 100)}%)`
            + `\n  sprite:    ${<i64>(sprite * 1000)}us (${<i32>(sprite / total * 100)}%)`
            + `\n  composite: ${<i64>(composite * 1000)}us (${<i32>(composite / total * 100)}%)`
            + `\n  total:     ${<i64>(total * 1000)}us`);
    }
}
