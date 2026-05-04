import { GB_IO_START, GB_VIDEO_BANK_SIZE, GB_VIDEO_START } from "../../memory/memoryConstants";
import { LCD_WIDTH } from "./constants";
import { Lcd, LcdControlBit } from "./lcd";
import { OamAttribute } from "./oam";
import { Ppu, PpuOamFifo } from "./ppu";
import { TileCache } from "./tileCache";
import { perfNow } from "../../debug/perfMarks";
import { CgbState } from "../../cgbState";
import { Cartridge } from "../../cartridge";
import { CGBMode } from "../../metadata";


@final
export class ScanlineRenderer {
    private static pixels: StaticArray<u8> = new StaticArray<u8>(LCD_WIDTH);

    // Precomputed per-scanline sprite data (indexed by FIFO position 0..9)
    private static spriteXPos: StaticArray<u8> = new StaticArray<u8>(10);
    // Decoded pixel colors by pixel offset [0..7] from sprite left edge (xFlip already applied)
    private static spritePixels: StaticArray<u8> = new StaticArray<u8>(80); // 10 * 8
    private static spritePalette: StaticArray<u8> = new StaticArray<u8>(10);
    private static spriteBgPrio: StaticArray<u8> = new StaticArray<u8>(10);
    // Precomputed shade index LUTs (colorId → shade 0-3 after palette apply)
    private static bgShade: StaticArray<u8> = new StaticArray<u8>(4);
    private static spriteShade: StaticArray<u8> = new StaticArray<u8>(40); // 10 * 4

    // CGB-only per-pixel BG data
    private static bgPaletteNum: StaticArray<u8> = new StaticArray<u8>(LCD_WIDTH);
    private static bgPriority: StaticArray<u8> = new StaticArray<u8>(LCD_WIDTH);
    // CGB-only per-sprite data
    private static spriteCgbPalette: StaticArray<u8> = new StaticArray<u8>(10);

    static bgTotalTicks: f64 = 0;
    static spriteTotalTicks: f64 = 0;
    static compositeTotalTicks: f64 = 0;

    static Init(): void {
        TileCache.Init();
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
        if (CgbState.isCgbMode) {
            ScanlineRenderer.RenderCGB();
            return;
        }

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
            const scrollX: u8 = lcd.scrollX;
            const scrollY: u8 = lcd.scrollY;
            const offset: u8 = scrollX & 7;
            const bgMapY: u8 = y + scrollY;
            const tileBaseAdj: u8 = tileBaseIsLow ? 0 : 128;

            if (!winVisible) {
                // Fast path: no window active — all loop-invariants hoisted, tile cache for decode
                const bgMapRowBase: u32 = Lcd.BgTileMapBaseAddress + (<u16>(bgMapY >> 3) << 5);
                const tileRow: u32 = bgTileY >> 1;
                const tileBase16: u32 = tileBaseIsLow ? 0 : 128; // (tilesBase - GB_VIDEO_START) / 16
                const tileCache = TileCache.data;
                for (let x: u8 = 0; x < LCD_WIDTH;) {
                    const mapX: u8 = x + scrollX;
                    const dataIndex: u8 = load<u8>(bgMapRowBase + (mapX >> 3));
                    const tileIdx: u32 = tileBase16 + <u32><u8>(dataIndex + tileBaseAdj);
                    const cacheBase: u32 = (tileIdx * 8 + tileRow) << 3;
                    const startI: i16 = x == 0 ? offset : 0;
                    const endI: i16 = x + 8 > LCD_WIDTH ? offset : 8;
                    for (let i = startI; i < endI; i++) {
                        unchecked(pixels[x++] = unchecked(tileCache[cacheBase + i]));
                    }
                }
            } else {
                // Slow path: window may be active
                const bgMapRowBase: u32 = Lcd.BgTileMapBaseAddress + (<u16>(bgMapY >> 3) << 5);
                const winMapY: u8 = Lcd.WindowLineY;
                const winMapRowBase: u32 = Lcd.WindowTileMapBaseAddress + (<u16>(winMapY >> 3) << 5);
                const tileRow_bg: u32 = bgTileY >> 1;
                const tileRow_win: u32 = winTileY >> 1;
                const tileBase16: u32 = tileBaseIsLow ? 0 : 128;
                const tileCache = TileCache.data;
                for (let x: u8 = 0; x < LCD_WIDTH;) {
                    const inWindow = ScanlineRenderer.isInWindow(x, winX);
                    const mapX: u8 = inWindow ? x + 7 - winX : x + scrollX;
                    const mapRowBase: u32 = inWindow ? winMapRowBase : bgMapRowBase;
                    const dataIndex: u8 = load<u8>(mapRowBase + (mapX >> 3));
                    const tileIdx: u32 = tileBase16 + <u32><u8>(dataIndex + tileBaseAdj);
                    const tileRow: u32 = inWindow ? tileRow_win : tileRow_bg;
                    const cacheBase: u32 = (tileIdx * 8 + tileRow) << 3;
                    const startI: i16 = !inWindow && x == 0 ? offset : 0;
                    const endI: i16 = !inWindow && x + 8 > LCD_WIDTH ? offset : 8;
                    for (let i = startI; i < endI; i++) {
                        unchecked(pixels[x++] = unchecked(tileCache[cacheBase + i]));
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
                unchecked(ScanlineRenderer.spriteBgPrio[fi] = oam.hasAttr(OamAttribute.BGandWindowOver) ? 1 : 0);
                const pal = oam.hasAttr(OamAttribute.PaletteNumber) ? Lcd.data.objPalette1 : Lcd.data.objPalette0;
                const palMasked: u8 = pal & 0b11111100;
                const shadeBase = fi * 4;
                for (let c: u8 = 0; c < 4; c++) {
                    unchecked(ScanlineRenderer.spriteShade[shadeBase + c] = Ppu.applyPalette(c, palMasked));
                }
            }
        }

        // --- Composite: sprites + shade index output (single pass) ---
        // @ts-ignore
        if (isDefined(INSTRUMENTED)) { t2 = perfNow(); ScanlineRenderer.spriteTotalTicks += t2 - t1; }
        const bufferOffset = y * LCD_WIDTH;
        const workingBufferPtr = Ppu.workingBufferPtr;
        let spriteHead: i32 = 0;

        // Precompute BG shade LUT: bgColorId (0-3) → shade index after palette apply
        const bgShade = ScanlineRenderer.bgShade;
        for (let c: u8 = 0; c < 4; c++) {
            unchecked(bgShade[c] = Ppu.applyPalette(bgEnabled ? c : 0, BgPalette));
        }
        const spriteShade = ScanlineRenderer.spriteShade;

        for (let x: u8 = 0; x < LCD_WIDTH; x++) {
            const bgColorId = unchecked(pixels[x]);
            let finalShade: u8 = unchecked(bgShade[bgColorId]);

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

                    const pixOff: u8 = <u8>(-offset); // [0, 7]
                    const spriteColorId = unchecked(ScanlineRenderer.spritePixels[si * 8 + pixOff]);
                    if (spriteColorId == 0) continue; // transparent pixel, try next sprite

                    // Highest-priority opaque sprite pixel found; its flag governs all lower sprites too
                    if (unchecked(ScanlineRenderer.spriteBgPrio[si]) && bgColorId != 0) break; // BG wins

                    finalShade = unchecked(spriteShade[si * 4 + spriteColorId]);
                    break;
                }
            }

            store<u8>(workingBufferPtr + <u32>(x + bufferOffset), finalShade);
        }
        // @ts-ignore
        if (isDefined(INSTRUMENTED)) ScanlineRenderer.compositeTotalTicks += perfNow() - t2;
    }

    private static RenderCGB(): void {
        const pixels = ScanlineRenderer.pixels;
        const bgPaletteNum = ScanlineRenderer.bgPaletteNum;
        const bgPriority = ScanlineRenderer.bgPriority;

        // DMG-compat: forced-CGB rendering of a DMG cart. Tile attribute byte ignored (no CGB
        // palette/bank/flip/prio); raw colorIds remapped through DMG palette regs (BGP/OBP0/OBP1)
        // before the CGB palette RAM lookup. Sprite palette = OAM bit 4 (DMG OBP0/OBP1 select).
        const dmgCompat: boolean = Cartridge.Data.getCGBMode() == CGBMode.NonCGB;
        const bgp:  u8 = load<u8>(GB_IO_START + 0x47);
        const obp0: u8 = load<u8>(GB_IO_START + 0x48);
        const obp1: u8 = load<u8>(GB_IO_START + 0x49);

        const lcd = Lcd.data;
        const y = lcd.lY;
        const bgScrollX: u8 = lcd.scrollX;
        const bgScrollY: u8 = lcd.scrollY;
        const bgMapY: u8 = y + bgScrollY;
        const tileBaseIsLow = lcd.hasControlBit(LcdControlBit.BGandWindowTileArea);
        const tileBaseAdj: u8 = tileBaseIsLow ? 0 : 128;
        const tileBase16: u32 = tileBaseIsLow ? 0 : 128;
        const offset: u8 = bgScrollX & 7;

        const bgMapRowBase: u32 = Lcd.BgTileMapBaseAddress + (<u16>(bgMapY >> 3) << 5);
        const winVisible = Lcd.IsWindowVisible;
        const winX = lcd.windowX;
        const winMapY: u8 = Lcd.WindowLineY;
        const winMapRowBase: u32 = Lcd.WindowTileMapBaseAddress + (<u16>(winMapY >> 3) << 5);

        // --- BG + Window (CGB): raw VRAM read, tile attributes from bank 1 ---
        for (let x: u8 = 0; x < LCD_WIDTH;) {
            const inWindow = winVisible && ScanlineRenderer.isInWindow(x, winX);
            const mapX: u8 = inWindow ? x + 7 - <u8>winX : x + bgScrollX;
            const mapRowBase: u32 = inWindow ? winMapRowBase : bgMapRowBase;
            const mapIdx: u32 = mapX >> 3;

            const dataIndex: u8 = load<u8>(mapRowBase + mapIdx);
            // tile attributes always from VRAM bank 1 (same offset + GB_VIDEO_BANK_SIZE).
            // DMG-compat: hardware ignores the CGB attribute byte entirely (and bank 1 may be uninit garbage).
            const attrs: u8 = dmgCompat ? 0 : load<u8>(mapRowBase + GB_VIDEO_BANK_SIZE + mapIdx);

            const cgbPalette: u8 = attrs & 0x07;
            const vramBank: u8 = (attrs >> 3) & 1;
            const hFlip = (attrs & 0x20) != 0;
            const vFlip = (attrs & 0x40) != 0;
            const bgPrio: u8 = (attrs >> 7) & 1;

            const tileIdx: u32 = tileBase16 + <u32><u8>(dataIndex + tileBaseAdj);

            let tileRow: u32 = inWindow ? (<u32>winMapY & 7) : (<u32>bgMapY & 7);
            if (vFlip) tileRow = 7 - tileRow;

            const vramBankOff: u32 = <u32>vramBank * GB_VIDEO_BANK_SIZE;
            const tileDataAddr: u32 = GB_VIDEO_START + vramBankOff + tileIdx * 16 + tileRow * 2;
            const lo: u8 = load<u8>(tileDataAddr);
            const hi: u8 = load<u8>(tileDataAddr + 1);

            const startI: i16 = !inWindow && x == 0 ? <i16>offset : 0;
            const endI: i16 = !inWindow && x + 8 > LCD_WIDTH ? <i16>offset : 8;

            for (let i = startI; i < endI; i++) {
                const bit: u8 = hFlip ? <u8>i : (7 - <u8>i);
                const colorId: u8 = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
                unchecked(pixels[x] = colorId);
                unchecked(bgPaletteNum[x] = cgbPalette);
                unchecked(bgPriority[x] = bgPrio);
                x++;
            }
        }

        // --- Pre-decode sprites (CGB) ---
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
                const sprVramBankOff: u32 = oam.hasAttr(OamAttribute.TileBank)
                    ? GB_VIDEO_BANK_SIZE : 0;
                const spriteBytes: u16 = load<u16>(GB_VIDEO_START + sprVramBankOff + (<u32>tileIndex * 16) + <u32>spriteY * 2);
                const lo: u8 = <u8>spriteBytes;
                const hi: u8 = <u8>(spriteBytes >> 8);
                const xFlip = oam.hasAttr(OamAttribute.XFlip);
                const base = fi * 8;
                for (let pixOff: u8 = 0; pixOff < 8; pixOff++) {
                    const bit: u8 = xFlip ? pixOff : (7 - pixOff);
                    unchecked(ScanlineRenderer.spritePixels[base + pixOff] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1));
                }
                unchecked(ScanlineRenderer.spriteXPos[fi] = oam.xPos);
                unchecked(ScanlineRenderer.spriteBgPrio[fi] = oam.hasAttr(OamAttribute.BGandWindowOver) ? 1 : 0);
                // DMG-compat: palette comes from OAM bit 4 (DMG OBP0/OBP1 select), CGB pal bits ignored.
                unchecked(ScanlineRenderer.spriteCgbPalette[fi] = dmgCompat
                    ? (oam.flags >> 4) & 1
                    : oam.flags & 0x07);
            }
        }

        // --- Composite (CGB): RGB555 output ---
        // LCDC bit 0 in CGB = master BG priority; 0 = OBJ always wins regardless of attr flags
        const masterBgPriority = Lcd.BGandWindowVisible;
        const cgbBufferPtr = Ppu.cgbWorkingBufferPtr;
        const bufferOffset = <u32>y * LCD_WIDTH;

        for (let x: u8 = 0; x < LCD_WIDTH; x++) {
            const bgColorId = unchecked(pixels[x]);
            const bgIdx: u8 = dmgCompat ? ((bgp >> (bgColorId << 1)) & 3) : bgColorId;
            let finalColor: u16 = Lcd.getCGBBgColor(unchecked(bgPaletteNum[x]), bgIdx);

            if (numSprites > 0) {
                for (let si = 0; si < numSprites; si++) {
                    const spriteXPos = unchecked(ScanlineRenderer.spriteXPos[si]);
                    const spriteX: i16 = <i16>spriteXPos - 8;

                    if (spriteX >= <i16>x + 8) continue; // CGB: OAM-index order, not X-sorted

                    const overlaps = (spriteX >= <i16>x && spriteX < <i16>x + 8)
                        || (spriteX < <i16>x && spriteX + 8 >= <i16>x);
                    if (!overlaps) continue;

                    const sprOffset: i16 = spriteX - x;
                    if (sprOffset < -7 || sprOffset > 0) continue;

                    const pixOff: u8 = <u8>(-sprOffset);
                    const spriteColorId = unchecked(ScanlineRenderer.spritePixels[si * 8 + pixOff]);
                    if (spriteColorId == 0) continue;

                    let objWins: bool;
                    if (!masterBgPriority) {
                        objWins = true;
                    } else {
                        const bgHasPrio = unchecked(ScanlineRenderer.bgPriority[x]) != 0 && bgColorId != 0;
                        const objHasBgPrio = unchecked(ScanlineRenderer.spriteBgPrio[si]) != 0 && bgColorId != 0;
                        objWins = !bgHasPrio && !objHasBgPrio;
                    }

                    if (objWins) {
                        const palNum: u8 = unchecked(ScanlineRenderer.spriteCgbPalette[si]);
                        const objIdx: u8 = dmgCompat
                            ? (((palNum != 0 ? obp1 : obp0) >> (spriteColorId << 1)) & 3)
                            : spriteColorId;
                        finalColor = Lcd.getCGBObjColor(palNum, objIdx);
                    }
                    break;
                }
            }

            store<u16>(cgbBufferPtr + (<u32>x + bufferOffset) * 2, finalColor);
        }
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
