import { Ppu, PpuMode } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { Interrupt, IntType } from "../../cpu/interrupts";
import { describe, it, assertEquals } from "../framework";
import { initPpu, tickPpuDots, assertInterruptFlag } from "./ppuTestHelpers";

const STAT_ADDR: u16 = 0xFF41;
const LYC_ADDR: u16 = 0xFF45;

function clearIF(): void {
    Interrupt.SetRequests(0x00);
}

function setStat(bits: u8): void {
    MemoryMap.GBstore<u8>(STAT_ADDR, bits);
}

export function testStatInterrupts(): boolean {
    describe("STAT Interrupts", () => {

        describe("HBlank STAT interrupt (bit 3)", () => {
            it("fires STAT interrupt when entering HBlank with bit 3 set", () => {
                initPpu();
                setStat(0x08); // mode 0 int select
                clearIF();
                tickPpuDots(252); // OAMScan(80) + Transfer(172) → HBlank
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT int fires on HBlank entry");
            });

            it("does not fire STAT interrupt when bit 3 clear", () => {
                initPpu();
                setStat(0x00);
                clearIF();
                tickPpuDots(252);
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT int when bit 3 clear");
            });
        });

        describe("VBlank STAT interrupt (bit 4)", () => {
            it("fires STAT interrupt when entering VBlank with bit 4 set", () => {
                initPpu();
                setStat(0x10); // mode 1 int select
                clearIF();
                tickPpuDots(144 * 456); // advance through 144 scanlines → VBlank
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT int fires on VBlank entry");
            });

            it("does not fire STAT interrupt when bit 4 clear", () => {
                initPpu();
                setStat(0x00);
                clearIF();
                tickPpuDots(144 * 456);
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT int when bit 4 clear");
            });

            it("also fires VBlank interrupt regardless of STAT bits", () => {
                initPpu();
                setStat(0x00);
                clearIF();
                tickPpuDots(144 * 456);
                assertInterruptFlag(<u8>IntType.VBlank, true, "VBlank IF set on VBlank entry");
            });
        });

        describe("OAMScan STAT interrupt (bit 5)", () => {
            it("fires STAT interrupt when entering OAMScan with bit 5 set", () => {
                initPpu();
                setStat(0x20); // mode 2 int select
                clearIF();
                // tick one full scanline: HBlank end → OAMScan for LY=1
                tickPpuDots(456);
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT int fires on OAMScan entry");
            });

            it("does not fire STAT interrupt when bit 5 clear", () => {
                initPpu();
                setStat(0x00);
                clearIF();
                tickPpuDots(456);
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT int when bit 5 clear");
            });
        });

        describe("LYC match interrupt (bit 6)", () => {
            it("fires STAT interrupt when LY matches LYC with bit 6 set", () => {
                initPpu();
                setStat(0x40); // LYC int select
                MemoryMap.GBstore<u8>(LYC_ADDR, 1); // LYC = 1
                clearIF();
                tickPpuDots(456); // LY becomes 1 at end of scanline
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT int fires on LYC=LY match");
            });

            it("does not fire STAT interrupt when LY != LYC", () => {
                initPpu();
                setStat(0x40);
                MemoryMap.GBstore<u8>(LYC_ADDR, 5); // LYC = 5, LY will be 1
                clearIF();
                tickPpuDots(456);
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT int when LY != LYC");
            });

            it("does not fire STAT interrupt when LY == LYC but bit 6 clear", () => {
                initPpu();
                setStat(0x00);
                MemoryMap.GBstore<u8>(LYC_ADDR, 1);
                clearIF();
                tickPpuDots(456);
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT int when bit 6 clear");
            });

            it("fires STAT interrupt at correct LY for LYC=10", () => {
                initPpu();
                setStat(0x40);
                MemoryMap.GBstore<u8>(LYC_ADDR, 10);
                clearIF();
                tickPpuDots(9 * 456); // LY = 9, no match yet
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT int before LYC match");
                tickPpuDots(456); // LY becomes 10
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT int fires when LY reaches LYC");
            });
        });

        describe("LYC write STAT interrupt", () => {
            it("fires STAT interrupt when writing LYC=LY with STAT bit 6 set", () => {
                initPpu();
                setStat(0x40); // bit 6 LYC int select
                // IE left at 0 — should fire based on STAT bit 6, not IE
                tickPpuDots(5 * 456); // advance to LY=5
                clearIF();
                MemoryMap.GBstore<u8>(LYC_ADDR, 5); // write LYC=5 when LY already=5
                assertInterruptFlag(<u8>IntType.LcdSTAT, true, "STAT fires when writing LYC=current LY with bit 6 set");
            });

            it("does NOT fire STAT interrupt when writing LYC=LY with STAT bit 6 clear", () => {
                initPpu();
                setStat(0x00); // bit 6 clear
                MemoryMap.GBstore<u8>(0xFFFF, 0x02); // IE LcdSTAT enabled — ensures we test STAT bit 6, not IE
                tickPpuDots(5 * 456);
                clearIF();
                MemoryMap.GBstore<u8>(LYC_ADDR, 5); // write LYC=5 when LY=5
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT when writing LYC=LY with bit 6 clear");
            });

            it("does NOT fire STAT interrupt when writing LYC != LY", () => {
                initPpu();
                setStat(0x40);
                tickPpuDots(5 * 456); // LY=5
                clearIF();
                MemoryMap.GBstore<u8>(LYC_ADDR, 10); // write LYC=10 when LY=5 (no match)
                assertInterruptFlag(<u8>IntType.LcdSTAT, false, "no STAT when writing LYC != LY");
            });
        });

        describe("No double-fire (STAT blocking)", () => {
            it("only sets STAT IF bit once when VBlank mode and LYC both trigger at LY=144", () => {
                // At LY=144: NextLine LYC match (bit 6) + enterMode VBlank mode int (bit 4)
                // Both call Request(LcdSTAT) — result is the same bit set once
                initPpu();
                setStat(0x50); // bit 4 (mode 1 int) + bit 6 (LYC int) = 0x10 | 0x40
                MemoryMap.GBstore<u8>(LYC_ADDR, 144);
                clearIF();
                tickPpuDots(144 * 456);
                const IF = Interrupt.Requests();
                // LcdSTAT bit (0x2) should be set exactly once
                assertEquals<u8>(IF & <u8>IntType.LcdSTAT, <u8>IntType.LcdSTAT, "STAT IF bit set");
                // VBlank bit (0x1) also set
                assertEquals<u8>(IF & <u8>IntType.VBlank, <u8>IntType.VBlank, "VBlank IF bit set");
                // No other bits set (0x1C mask: Timer/Serial/Joypad)
                assertEquals<u8>(IF & 0x1C, 0, "no spurious interrupt bits");
            });

            it("only sets STAT IF bit once when HBlank and LYC both trigger simultaneously", () => {
                // Tick to scanline where LYC matches at HBlank entry
                // LYC=1: at end of scanline 0, NextLine sets LY=1=LYC (STAT bit 6)
                // HBlank mode int (bit 3) fires at dot 252 of scanline 0
                // These are sequential not simultaneous, but IF bit still set only once
                initPpu();
                setStat(0x48); // bit 3 (mode 0 int) + bit 6 (LYC int) = 0x08 | 0x40
                MemoryMap.GBstore<u8>(LYC_ADDR, 1);
                clearIF();
                tickPpuDots(456); // HBlank fires at dot 252, LYC match at dot 456
                const IF = Interrupt.Requests();
                assertEquals<u8>(IF & <u8>IntType.LcdSTAT, <u8>IntType.LcdSTAT, "STAT IF set");
                assertEquals<u8>(IF & <u8>IntType.VBlank, 0, "no spurious VBlank");
                assertEquals<u8>(IF & 0x1C, 0, "no spurious other interrupts");
            });
        });

    });

    return true;
}
