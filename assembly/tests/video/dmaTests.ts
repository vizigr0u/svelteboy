import { Dma } from "../../io/video/dma";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_OAM_START } from "../../memory/memoryConstants";
import { describe, it, assertEquals } from "../framework";
import { setTestRom } from "../cpuTests";

const DMA_REG: u16 = 0xFF46;
const OAM_ADDR: u16 = 0xFE00;
const SRC_HIGH: u8 = 0xC0; // WRAM $C000-$C09F

function initDma(): void {
    setTestRom([0x00]);
    MemoryMap.GBstore<u8>(0xFF40, 0x80); // enable PPU
}

function fillSrc(base: u8): void {
    for (let i: u16 = 0; i < 160; i++) {
        MemoryMap.GBstore<u8>((<u16>SRC_HIGH << 8) + i, base + <u8>i);
    }
}

function triggerDma(srcHigh: u8): void {
    MemoryMap.GBstore<u8>(DMA_REG, srcHigh);
}

// Advance DMA by n M-cycles (one Dma.Tick = one M-cycle)
function tickDma(n: u32): void {
    for (let i: u32 = 0; i < n; i++) {
        Dma.Tick();
    }
}

export function testDma(): boolean {
    describe("OAM DMA", () => {

        describe("DMA copies 160 bytes from source to OAM", () => {
            it("copies all 160 bytes after full transfer", () => {
                initDma();
                fillSrc(0x10);
                triggerDma(SRC_HIGH);
                tickDma(162); // 2 delay + 160 transfer
                for (let i: u32 = 0; i < 160; i++) {
                    assertEquals<u8>(
                        load<u8>(GB_OAM_START + i),
                        0x10 + <u8>i,
                        "OAM byte " + i.toString()
                    );
                }
            });

            it("DMA inactive after 160-byte transfer", () => {
                initDma();
                fillSrc(0x10);
                triggerDma(SRC_HIGH);
                tickDma(162);
                assertEquals<bool>(Dma.active, false, "DMA inactive after full transfer");
            });
        });

        describe("2-cycle start delay before transfer begins", () => {
            it("no bytes written after 1 M-cycle (delay ongoing)", () => {
                initDma();
                store<u8>(GB_OAM_START, 0x42); // known sentinel in OAM[0]
                fillSrc(0xBB);
                triggerDma(SRC_HIGH);
                tickDma(1);
                assertEquals<u8>(load<u8>(GB_OAM_START), 0x42, "OAM[0] unchanged after 1 tick");
            });

            it("no bytes written after 2 M-cycles (delay period)", () => {
                initDma();
                store<u8>(GB_OAM_START, 0x42);
                fillSrc(0xBB);
                triggerDma(SRC_HIGH);
                tickDma(2);
                assertEquals<u8>(load<u8>(GB_OAM_START), 0x42, "OAM[0] unchanged after 2 ticks");
            });

            it("first byte written on 3rd M-cycle (delay elapsed)", () => {
                initDma();
                store<u8>(GB_OAM_START, 0x42);
                fillSrc(0xBB);
                triggerDma(SRC_HIGH);
                tickDma(3); // 2 delay + 1 transfer
                assertEquals<u8>(load<u8>(GB_OAM_START), 0xBB, "OAM[0] written on tick 3");
            });
        });

        describe("Transfer completes in 160 machine cycles", () => {
            it("DMA still active at 161 M-cycles (2 delay + 159 transfer)", () => {
                initDma();
                fillSrc(0x10);
                triggerDma(SRC_HIGH);
                tickDma(161); // 1 byte remaining
                assertEquals<bool>(Dma.active, true, "DMA still active at 161 ticks");
            });

            it("DMA inactive at 162 M-cycles (2 delay + 160 transfer)", () => {
                initDma();
                fillSrc(0x10);
                triggerDma(SRC_HIGH);
                tickDma(162);
                assertEquals<bool>(Dma.active, false, "DMA completes at 162 ticks");
            });

            it("first and last OAM bytes correct after 162 M-cycles", () => {
                initDma();
                fillSrc(0x55);
                triggerDma(SRC_HIGH);
                tickDma(162);
                assertEquals<u8>(load<u8>(GB_OAM_START), 0x55, "OAM[0] correct");
                assertEquals<u8>(load<u8>(GB_OAM_START + 159), <u8>(0x55 + 159), "OAM[159] correct");
            });
        });

        describe("OAM reads return 0xFF during active DMA", () => {
            it("OAM read returns 0xFF during delay period", () => {
                initDma();
                store<u8>(GB_OAM_START, 0x42);
                fillSrc(0x10);
                triggerDma(SRC_HIGH);
                tickDma(1); // still in delay, DMA active
                assertEquals<u8>(MemoryMap.GBload<u8>(OAM_ADDR), 0xFF, "OAM returns 0xFF during delay");
            });

            it("OAM read returns 0xFF mid-transfer", () => {
                initDma();
                store<u8>(GB_OAM_START + 80, 0x42);
                fillSrc(0x10);
                triggerDma(SRC_HIGH);
                tickDma(10); // 2 delay + 8 transfer, DMA still active
                assertEquals<u8>(MemoryMap.GBload<u8>(OAM_ADDR + 80), 0xFF, "OAM returns 0xFF mid-transfer");
            });

            it("OAM read returns real data after DMA completes", () => {
                initDma();
                fillSrc(0x77);
                triggerDma(SRC_HIGH);
                tickDma(162);
                assertEquals<u8>(MemoryMap.GBload<u8>(OAM_ADDR), 0x77, "OAM readable after DMA");
                assertEquals<u8>(MemoryMap.GBload<u8>(OAM_ADDR + 10), <u8>(0x77 + 10), "OAM[10] readable after DMA");
            });
        });

    });

    return true;
}
