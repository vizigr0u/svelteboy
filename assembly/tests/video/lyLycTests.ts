import { Ppu } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { Interrupt, IntType } from "../../cpu/interrupts";
import { describe, it, assertEquals } from "../framework";
import { initPpu, tickPpuDots, assertLY, assertStatBit, assertInterruptFlag } from "./ppuTestHelpers";

const LYC_ADDR: u16 = 0xFF45;
const STAT_ADDR: u16 = 0xFF41;

function clearIF(): void {
    Interrupt.SetRequests(0);
}

export function testLyLyc(): boolean {
    describe("LY/LYC", () => {

        describe("LY increments per scanline", () => {
            it("LY=0 at init", () => {
                initPpu();
                assertLY(0, "LY=0 at init");
            });

            it("LY=1 after 456 dots", () => {
                initPpu();
                tickPpuDots(456);
                assertLY(1, "LY after scanline 0");
            });

            it("LY=153 after 153 scanlines", () => {
                initPpu();
                tickPpuDots(153 * 456);
                assertLY(153, "LY=153");
            });

            it("LY wraps to 0 after scanline 153 (154 total)", () => {
                initPpu();
                tickPpuDots(154 * 456);
                assertLY(0, "LY wraps to 0 after frame");
            });
        });

        describe("LY is read-only", () => {
            it("write to LY ($FF44) has no effect on LY value", () => {
                initPpu();
                tickPpuDots(5 * 456);
                assertLY(5, "LY=5 before write");
                MemoryMap.GBstore<u8>(0xFF44, 99); // attempt write
                assertLY(5, "LY unchanged after write to $FF44");
            });
        });

        describe("LY == LYC sets STAT bit 2", () => {
            it("STAT bit 2 set when LY==LYC==0 at init", () => {
                initPpu();
                // LY=0, LYC=0 after init — bit 2 computed dynamically on STAT read
                assertStatBit(2, true, "STAT bit 2 when LY==LYC==0");
            });

            it("STAT bit 2 set when LY reaches LYC", () => {
                initPpu();
                MemoryMap.GBstore<u8>(LYC_ADDR, 5);
                tickPpuDots(5 * 456);
                assertLY(5, "LY=5");
                assertStatBit(2, true, "STAT bit 2 set when LY==LYC==5");
            });

            it("STAT bit 2 clear when LY != LYC", () => {
                initPpu();
                MemoryMap.GBstore<u8>(LYC_ADDR, 10);
                tickPpuDots(5 * 456);
                assertLY(5, "LY=5 with LYC=10");
                assertStatBit(2, false, "STAT bit 2 clear when LY!=LYC");
            });
        });

        describe("LYC STAT interrupt (STAT bit 6)", () => {
            it("fires STAT interrupt when LY==LYC and STAT bit 6 set", () => {
                initPpu();
                MemoryMap.GBstore<u8>(LYC_ADDR, 10);
                MemoryMap.GBstore<u8>(STAT_ADDR, 0x40); // set LYC int select
                clearIF();
                tickPpuDots(10 * 456);
                assertLY(10, "LY=10");
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT interrupt fired at LY==LYC");
            });

            it("no STAT interrupt when STAT bit 6 clear", () => {
                initPpu();
                MemoryMap.GBstore<u8>(LYC_ADDR, 10);
                // STAT bit 6 not set
                clearIF();
                tickPpuDots(10 * 456);
                assertLY(10, "LY=10");
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT interrupt without bit 6");
            });
        });

        describe("LY frame boundary LYC=0", () => {
            it("fires STAT interrupt when LY resets to 0 matching LYC=0 at frame boundary", () => {
                initPpu();
                MemoryMap.GBstore<u8>(LYC_ADDR, 0);
                MemoryMap.GBstore<u8>(STAT_ADDR, 0x40);
                tickPpuDots(456); // advance past initial LY=0
                clearIF();
                tickPpuDots(153 * 456); // LY: 1→...→154→reset→0
                assertLY(0, "LY=0 after frame boundary");
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT fires when LY resets to 0=LYC");
            });

            it("STAT bit 2 set when LY resets to 0 matching LYC=0", () => {
                initPpu();
                MemoryMap.GBstore<u8>(LYC_ADDR, 0);
                tickPpuDots(456); // past initial LY=0
                tickPpuDots(153 * 456); // LY wraps to 0
                assertStatBit(2, true, "STAT bit 2 reflects LY==LYC==0 after frame reset");
            });
        });

        describe("VBlank interrupt at LY=144", () => {
            it("VBlank interrupt fires on entering LY=144", () => {
                initPpu();
                clearIF();
                tickPpuDots(144 * 456);
                assertLY(144, "LY=144");
                assertInterruptFlag(<u8>IntType.VBlank, true, "VBlank interrupt at LY=144");
            });

            it("no VBlank interrupt before LY=144", () => {
                initPpu();
                clearIF();
                tickPpuDots(143 * 456 + 455); // last dot of scanline 143 HBlank
                assertLY(143, "LY still 143");
                assertInterruptFlag(<u8>IntType.VBlank, false, "no VBlank before LY=144");
            });
        });
    });

    return true;
}
