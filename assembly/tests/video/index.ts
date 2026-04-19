import { testTileToRgba } from "./tileToRgbaTests";
import { testScanlineTiming } from "./scanlineTimingTests";
import { testLyLyc } from "./lyLycTests";
import { testStatInterrupts } from "./statInterruptTests";
import { testLcdc } from "./lcdcTests";

export function testVideo(): boolean {
    testTileToRgba();
    testScanlineTiming();
    testLyLyc();
    testStatInterrupts();
    testLcdc();
    return true;
}
