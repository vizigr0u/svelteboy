import { testTileToRgba } from "./tileToRgbaTests";
import { testScanlineTiming } from "./scanlineTimingTests";

export function testVideo(): boolean {
    testTileToRgba();
    testScanlineTiming();
    return true;
}
