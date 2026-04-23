import { CgbState } from "../cgbState";
import { Emulator } from "../emulator";
import { Dma } from "../io/video/dma";
import { MemoryMap } from "../memory/memoryMap";
import { GB_VIDEO_START, GB_VIDEO_BANK_SIZE, GB_WRAM_START, GB_WRAM_BANK_SIZE, CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { CGBMode } from "../metadata";
import { Cartridge } from "../cartridge";
import { describe, it, assertEquals } from "./framework";

function setupCGB(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, CGBMode.CGBOnly as u8);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Cartridge.Data.cgbFlag = CGBMode.CGBOnly as u8;
    Emulator.Init(false);
}

function testHdmaRegisters(): void {
    describe("HDMA register Handles", () => {
        it("Handles FF51-FF55 in CGB mode", () => {
            setupCGB();
            assertEquals<boolean>(Dma.Handles(0xFF51), true, "FF51");
            assertEquals<boolean>(Dma.Handles(0xFF52), true, "FF52");
            assertEquals<boolean>(Dma.Handles(0xFF53), true, "FF53");
            assertEquals<boolean>(Dma.Handles(0xFF54), true, "FF54");
            assertEquals<boolean>(Dma.Handles(0xFF55), true, "FF55");
        });

        it("Does not handle FF50 or FF56 in CGB mode", () => {
            setupCGB();
            assertEquals<boolean>(Dma.Handles(0xFF50), false, "FF50 not HDMA");
            assertEquals<boolean>(Dma.Handles(0xFF56), false, "FF56 not HDMA");
        });

        it("HDMA2 lower nibble masked to 0", () => {
            setupCGB();
            Dma.Store(0xFF52, 0xAF);
            assertEquals<u8>(Dma.hdma2, 0xA0, "HDMA2 lower nibble zeroed");
        });

        it("HDMA3 upper 3 bits masked out", () => {
            setupCGB();
            Dma.Store(0xFF53, 0xFF);
            assertEquals<u8>(Dma.hdma3, 0x1F, "HDMA3 only bits 4-0");
        });

        it("HDMA4 lower nibble masked to 0", () => {
            setupCGB();
            Dma.Store(0xFF54, 0x3B);
            assertEquals<u8>(Dma.hdma4, 0x30, "HDMA4 lower nibble zeroed");
        });

        it("FF55 reads 0xFF when inactive", () => {
            setupCGB();
            assertEquals<u8>(Dma.Load(0xFF55), 0xFF, "inactive = 0xFF");
        });
    });
}

function testGDMA(): void {
    describe("GDMA (General DMA, bit7=0)", () => {
        it("transfers all blocks immediately", () => {
            setupCGB();
            // fill ROM source at 0x1000 with pattern
            for (let i: u32 = 0; i < 32; i++) {
                store<u8>(CARTRIDGE_ROM_START + 0x1000 + i, <u8>(0xA0 + i));
            }
            Dma.Store(0xFF51, 0x10); // src high = 0x10 -> 0x1000
            Dma.Store(0xFF52, 0x00); // src low  = 0x00
            Dma.Store(0xFF53, 0x80); // dst high = 0x00 (masked: 0x00 -> 0x8000)
            Dma.Store(0xFF54, 0x00); // dst low  = 0x00
            // GDMA: 1 block (16 bytes), bit7=0, length=(0&0x7F)+1=1
            Dma.Store(0xFF55, 0x00);
            // should be done immediately, inactive
            assertEquals<boolean>(Dma.hdmaActive, false, "GDMA done after write");
            assertEquals<u8>(Dma.Load(0xFF55), 0xFF, "FF55=0xFF after GDMA");
            // verify data in VRAM bank 0 at 0x8000
            const vramBase = GB_VIDEO_START;
            for (let i: u32 = 0; i < 16; i++) {
                const got = load<u8>(vramBase + i);
                assertEquals<u8>(got, <u8>(0xA0 + i), "GDMA byte " + i.toString());
            }
        });

        it("transfers multiple blocks", () => {
            setupCGB();
            for (let i: u32 = 0; i < 48; i++) {
                store<u8>(CARTRIDGE_ROM_START + 0x2000 + i, <u8>(i));
            }
            Dma.Store(0xFF51, 0x20); // src 0x2000
            Dma.Store(0xFF52, 0x00);
            Dma.Store(0xFF53, 0x82); // dst 0x8200
            Dma.Store(0xFF54, 0x00);
            // 3 blocks (value=2 => (2&0x7F)+1=3 blocks)
            Dma.Store(0xFF55, 0x02);
            assertEquals<boolean>(Dma.hdmaActive, false, "GDMA 3 blocks done");
            const vramBase = GB_VIDEO_START + 0x200;
            for (let i: u32 = 0; i < 48; i++) {
                assertEquals<u8>(load<u8>(vramBase + i), <u8>(i), "byte " + i.toString());
            }
        });

        it("GDMA respects VRAM bank 1", () => {
            setupCGB();
            CgbState.setVramBank(1);
            for (let i: u32 = 0; i < 16; i++) {
                store<u8>(CARTRIDGE_ROM_START + 0x3000 + i, <u8>(0xBB));
            }
            Dma.Store(0xFF51, 0x30);
            Dma.Store(0xFF52, 0x00);
            Dma.Store(0xFF53, 0x80);
            Dma.Store(0xFF54, 0x00);
            Dma.Store(0xFF55, 0x00);
            const vramBank1 = GB_VIDEO_START + GB_VIDEO_BANK_SIZE;
            assertEquals<u8>(load<u8>(vramBank1), 0xBB, "written to VRAM bank 1");
            assertEquals<u8>(load<u8>(GB_VIDEO_START), 0x00, "VRAM bank 0 untouched");
            CgbState.setVramBank(0);
        });
    });
}

function testHBlankHDMA(): void {
    describe("HBlank HDMA (bit7=1)", () => {
        it("does not transfer immediately on write", () => {
            setupCGB();
            for (let i: u32 = 0; i < 32; i++) {
                store<u8>(CARTRIDGE_ROM_START + 0x4000 + i, <u8>(0xCC));
            }
            Dma.Store(0xFF51, 0x40);
            Dma.Store(0xFF52, 0x00);
            Dma.Store(0xFF53, 0x80);
            Dma.Store(0xFF54, 0x00);
            // HBlank HDMA, 2 blocks
            Dma.Store(0xFF55, 0x81);
            assertEquals<boolean>(Dma.hdmaActive, true, "still active after write");
            // no bytes transferred yet to VRAM
            assertEquals<u8>(load<u8>(GB_VIDEO_START), 0x00, "no transfer yet");
        });

        it("FF55 read returns remaining-1 with bit7=0 while active", () => {
            setupCGB();
            Dma.Store(0xFF51, 0x40);
            Dma.Store(0xFF52, 0x00);
            Dma.Store(0xFF53, 0x80);
            Dma.Store(0xFF54, 0x00);
            Dma.Store(0xFF55, 0x82); // 3 blocks, HBlank
            const status = Dma.Load(0xFF55);
            assertEquals<u8>(status & 0x80, 0x00, "bit7=0 while active");
            assertEquals<u8>(status & 0x7F, 0x02, "remaining-1 = 2");
        });

        it("HDMATick transfers one block per call", () => {
            setupCGB();
            for (let i: u32 = 0; i < 32; i++) {
                store<u8>(CARTRIDGE_ROM_START + 0x5000 + i, <u8>(0x10 + i));
            }
            Dma.Store(0xFF51, 0x50);
            Dma.Store(0xFF52, 0x00);
            Dma.Store(0xFF53, 0x81); // dst 0x8100
            Dma.Store(0xFF54, 0x00);
            Dma.Store(0xFF55, 0x81); // 2 blocks, HBlank
            // first HBlank tick
            Dma.HDMATick();
            assertEquals<u8>(Dma.hdmaBlocksRemaining, 1, "1 block remaining");
            assertEquals<boolean>(Dma.hdmaActive, true, "still active");
            const vramBase = GB_VIDEO_START + 0x100;
            assertEquals<u8>(load<u8>(vramBase), 0x10, "first byte block 1");
            assertEquals<u8>(load<u8>(vramBase + 15), 0x1F, "last byte block 1");
            // second block not yet transferred
            assertEquals<u8>(load<u8>(vramBase + 16), 0x00, "block 2 not yet done");
            // second HBlank tick
            Dma.HDMATick();
            assertEquals<u8>(Dma.hdmaBlocksRemaining, 0, "0 blocks remaining");
            assertEquals<boolean>(Dma.hdmaActive, false, "inactive after last block");
            assertEquals<u8>(load<u8>(vramBase + 16), 0x20, "block 2 first byte");
        });

        it("cancel HBlank HDMA by writing FF55 with bit7=0", () => {
            setupCGB();
            Dma.Store(0xFF51, 0x40);
            Dma.Store(0xFF52, 0x00);
            Dma.Store(0xFF53, 0x80);
            Dma.Store(0xFF54, 0x00);
            Dma.Store(0xFF55, 0x83); // 4 blocks HBlank
            assertEquals<boolean>(Dma.hdmaActive, true, "active");
            Dma.HDMATick(); // one block done
            // cancel
            Dma.Store(0xFF55, 0x00);
            assertEquals<boolean>(Dma.hdmaActive, false, "cancelled");
            assertEquals<u8>(Dma.Load(0xFF55), 0xFF, "FF55=0xFF after cancel");
        });
    });
}

function testHdmaInitValues(): void {
    describe("HDMA initial register values after CGB init", () => {
        it("HDMA1-4 read 0xFF (write-only registers)", () => {
            setupCGB();
            assertEquals<u8>(Dma.Load(0xFF51), 0xFF, "HDMA1 = 0xFF");
            assertEquals<u8>(Dma.Load(0xFF52), 0xFF, "HDMA2 = 0xFF");
            assertEquals<u8>(Dma.Load(0xFF53), 0xFF, "HDMA3 = 0xFF");
            assertEquals<u8>(Dma.Load(0xFF54), 0xFF, "HDMA4 = 0xFF");
        });

        it("HDMA5 reads 0xFF when inactive after init", () => {
            setupCGB();
            assertEquals<u8>(Dma.Load(0xFF55), 0xFF, "HDMA5 = 0xFF inactive");
        });

        it("hdmaActive is false after init", () => {
            setupCGB();
            assertEquals<boolean>(Dma.hdmaActive, false, "hdmaActive = false");
        });
    });
}

function testGDMAFromWRAM(): void {
    describe("GDMA from WRAM source (0xD000-0xDFF0)", () => {
        it("GDMA copies from WRAM bank 1 to VRAM", () => {
            setupCGB();
            // Write pattern directly to WRAM bank 1 physical memory (bank 1 is default after CGB init)
            const wramBank1Phys: u32 = GB_WRAM_START + 1 * GB_WRAM_BANK_SIZE;
            for (let i: u32 = 0; i < 16; i++) {
                store<u8>(wramBank1Phys + i, <u8>(0xE0 + i));
            }
            // Source: GB address 0xD000 maps to WRAM bank 1
            Dma.Store(0xFF51, 0xD0); // src high = 0xD0 → 0xD000
            Dma.Store(0xFF52, 0x00); // src low  = 0x00
            Dma.Store(0xFF53, 0x84); // dst high → 0x8400
            Dma.Store(0xFF54, 0x00); // dst low  = 0x00
            Dma.Store(0xFF55, 0x00); // GDMA, 1 block (16 bytes)
            assertEquals<boolean>(Dma.hdmaActive, false, "GDMA done");
            const vramDst: u32 = GB_VIDEO_START + 0x400;
            for (let i: u32 = 0; i < 16; i++) {
                assertEquals<u8>(load<u8>(vramDst + i), <u8>(0xE0 + i), "WRAM→VRAM byte " + i.toString());
            }
        });
    });
}

export function testHdma(): boolean {
    testHdmaRegisters();
    testHdmaInitValues();
    testGDMA();
    testGDMAFromWRAM();
    testHBlankHDMA();
    // reset all CGB state so subsequent tests (e.g. testInstructions) run in DMG mode
    Cartridge.Data.cgbFlag = 0x00;
    CgbState.setIsCGB(false);
    CgbState.setVramBank(0);
    return true;
}
