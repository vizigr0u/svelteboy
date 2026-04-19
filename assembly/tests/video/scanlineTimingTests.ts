import { Ppu, PpuMode } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { describe, it, assertEquals } from "../framework";
import { initPpu, tickPpuDots, assertPpuMode, assertLY, assertDot } from "./ppuTestHelpers";

const STAT_ADDR: u16 = 0xFF41;

function getStatModeBits(): u8 {
    return MemoryMap.GBload<u8>(STAT_ADDR) & 0b11;
}

export function testScanlineTiming(): boolean {
    describe("Scanline Timing", () => {

        describe("Mode Transition Sequence", () => {
            it("starts in OAMScan at dot 0", () => {
                initPpu();
                assertPpuMode(PpuMode.OAMScan, "initial mode");
                assertDot(0, "initial dot");
                assertEquals<u8>(getStatModeBits(), 2, "STAT bits = 2 (OAMScan)");
            });

            it("still OAMScan at dot 79", () => {
                initPpu();
                tickPpuDots(79);
                assertPpuMode(PpuMode.OAMScan, "mode at dot 79");
                assertEquals<u8>(getStatModeBits(), 2, "STAT bits = 2 (OAMScan)");
            });

            it("enters Transfer at dot 80", () => {
                initPpu();
                tickPpuDots(80);
                assertPpuMode(PpuMode.Transfer, "mode at dot 80");
                assertEquals<u8>(getStatModeBits(), 3, "STAT bits = 3 (Transfer)");
            });

            it("still Transfer at dot 251", () => {
                initPpu();
                tickPpuDots(251);
                assertPpuMode(PpuMode.Transfer, "mode at dot 251");
                assertEquals<u8>(getStatModeBits(), 3, "STAT bits = 3 (Transfer)");
            });

            it("enters HBlank at dot 252 (80+172)", () => {
                initPpu();
                tickPpuDots(252);
                assertPpuMode(PpuMode.HBlank, "mode at dot 252");
                assertEquals<u8>(getStatModeBits(), 0, "STAT bits = 0 (HBlank)");
            });

            it("enters OAMScan after 456 dots, LY=1, dot resets to 0", () => {
                initPpu();
                tickPpuDots(456);
                assertPpuMode(PpuMode.OAMScan, "mode after scanline 0");
                assertLY(1, "LY after 456 dots");
                assertDot(0, "dot reset to 0");
                assertEquals<u8>(getStatModeBits(), 2, "STAT bits = 2 (OAMScan)");
            });
        });

        describe("VBlank Transitions", () => {
            it("enters VBlank after 144 scanlines (LY=144)", () => {
                initPpu();
                tickPpuDots(144 * 456);
                assertPpuMode(PpuMode.VBlank, "mode at LY=144");
                assertLY(144, "LY=144 on VBlank entry");
                assertEquals<u8>(getStatModeBits(), 1, "STAT bits = 1 (VBlank)");
            });

            it("still in VBlank at LY=153", () => {
                initPpu();
                tickPpuDots(153 * 456);
                assertPpuMode(PpuMode.VBlank, "mode at LY=153");
                assertLY(153, "LY=153 last VBlank line");
                assertEquals<u8>(getStatModeBits(), 1, "STAT bits = 1 (VBlank)");
            });

            it("returns to OAMScan at LY=0 after 154 scanlines", () => {
                initPpu();
                tickPpuDots(154 * 456);
                assertPpuMode(PpuMode.OAMScan, "mode after VBlank");
                assertLY(0, "LY reset to 0");
                assertDot(0, "dot reset to 0");
                assertEquals<u8>(getStatModeBits(), 2, "STAT bits = 2 (OAMScan)");
            });
        });

        describe("Full Frame Cycle (154 × 456 = 70224 dots)", () => {
            it("one full frame returns to OAMScan LY=0 dot=0", () => {
                initPpu();
                tickPpuDots(70224);
                assertPpuMode(PpuMode.OAMScan, "mode after 70224 dots");
                assertLY(0, "LY=0 after full frame");
                assertDot(0, "dot=0 after full frame");
            });

            it("two full frames are consistent", () => {
                initPpu();
                tickPpuDots(70224 * 2);
                assertPpuMode(PpuMode.OAMScan, "mode after 2 frames");
                assertLY(0, "LY=0 after 2 frames");
                assertDot(0, "dot=0 after 2 frames");
            });
        });

    });

    return true;
}
