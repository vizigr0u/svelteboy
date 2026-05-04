import { testTileToRgba } from "./tileToRgbaTests";
import { testScanlineTiming } from "./scanlineTimingTests";
import { testLyLyc } from "./lyLycTests";
import { testStatInterrupts } from "./statInterruptTests";
import { testLcdc } from "./lcdcTests";
import { testDma } from "./dmaTests";
import { testBgRendering } from "./bgRenderingTests";
import { testWindowRendering } from "./windowRenderingTests";
import { testSprites } from "./spriteTests";
import { testFrameBuffer } from "./frameBufferTests";
import { testPalettes } from "./paletteTests";
import { testVramOamAccess } from "./vramOamAccessTests";
import { testVramBanking } from "./vramBankTests";
import { testCgbPalettes } from "./cgbPaletteTests";
import { testCgbRendering } from "./cgbRenderingTests";
import { testDmgCompatPalettes } from "./dmgCompatPaletteTests";
import { testDmgCompatRendering } from "./dmgCompatRenderingTests";

export function testVideo(): boolean {
    testTileToRgba();
    testScanlineTiming();
    testLyLyc();
    testStatInterrupts();
    testLcdc();
    testDma();
    testBgRendering();
    testWindowRendering();
    testSprites();
    testFrameBuffer();
    testPalettes();
    testVramOamAccess();
    testVramBanking();
    testCgbPalettes();
    testCgbRendering();
    testDmgCompatPalettes();
    testDmgCompatRendering();
    return true;
}
