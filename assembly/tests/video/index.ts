import { testTileToRgba } from "./tileToRgbaTests";
import { testScanlineTiming } from "./scanlineTimingTests";
import { testLyLyc } from "./lyLycTests";
import { testStatInterrupts } from "./statInterruptTests";

export function testVideo(): boolean {
    testTileToRgba();
    testScanlineTiming();
    testLyLyc();
    testStatInterrupts();
    return true;
}
