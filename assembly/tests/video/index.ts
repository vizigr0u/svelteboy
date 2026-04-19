import { testTileToRgba } from "./tileToRgbaTests";
import { testScanlineTiming } from "./scanlineTimingTests";
import { testLyLyc } from "./lyLycTests";
import { testStatInterrupts } from "./statInterruptTests";
import { testLcdc } from "./lcdcTests";
import { testDma } from "./dmaTests";
import { testBgRendering } from "./bgRenderingTests";
import { testWindowRendering } from "./windowRenderingTests";

export function testVideo(): boolean {
    testTileToRgba();
    testScanlineTiming();
    testLyLyc();
    testStatInterrupts();
    testLcdc();
    testDma();
    testBgRendering();
    testWindowRendering();
    return true;
}
