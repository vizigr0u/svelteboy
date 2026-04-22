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
    return true;
}
