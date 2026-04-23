import { Ppu, PpuMode } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { GB_OAM_START, GB_VIDEO_START } from "../../memory/memoryConstants";
import { describe, it, assertEquals } from "../framework";
import { initPpu, tickPpuDots, assertPpuMode, assertLY } from "./ppuTestHelpers";

// Prime OAM raw memory directly (bypasses protection, used as sentinel).
function primeOam(offset: u32, value: u8): void {
    store<u8>(GB_OAM_START + offset, value);
}

function readOamRaw(offset: u32): u8 {
    return load<u8>(GB_OAM_START + offset);
}

function writeOam(offset: u16, value: u8): void {
    MemoryMap.GBstore<u8>(0xFE00 + offset, value);
}

function readOam(offset: u16): u8 {
    return MemoryMap.GBload<u8>(0xFE00 + offset);
}

// Prime VRAM raw memory directly (bypasses protection, used as sentinel).
function primeVram(offset: u32, value: u8): void {
    store<u8>(GB_VIDEO_START + offset, value);
}

function readVramRaw(offset: u32): u8 {
    return load<u8>(GB_VIDEO_START + offset);
}

function readVram(offset: u16): u8 {
    return MemoryMap.GBload<u8>(0x8000 + offset);
}

function writeVram(offset: u16, value: u8): void {
    MemoryMap.GBstore<u8>(0x8000 + offset, value);
}

export function testVramOamAccess(): boolean {
    describe("OAM write access control", () => {

        // spec_vram_oam_access: OAM accessible only during Mode 0 (HBlank) and Mode 1 (VBlank).
        // Writes during Mode 2 (OAMScan) and Mode 3 (Transfer) are blocked.

        it("write blocked during Mode 2 (OAMScan)", () => {
            initPpu();
            assertPpuMode(PpuMode.OAMScan, "Mode 2 at start");
            primeOam(0, 0x42);
            writeOam(0, 0xBB);
            assertEquals<u8>(readOamRaw(0), 0x42, "OAM[0] unchanged after blocked write in Mode 2");
        });

        it("write blocked during Mode 3 (Transfer)", () => {
            initPpu();
            tickPpuDots(80); // OAMScan ends at dot 80, Transfer begins
            assertPpuMode(PpuMode.Transfer, "Mode 3 at dot 80");
            primeOam(4, 0x42);
            writeOam(4, 0xBB);
            assertEquals<u8>(readOamRaw(4), 0x42, "OAM[4] unchanged after blocked write in Mode 3");
        });

        it("write allowed during Mode 0 (HBlank)", () => {
            initPpu();
            tickPpuDots(252); // OAMScan(80) + Transfer(172) = 252
            assertPpuMode(PpuMode.HBlank, "Mode 0 at dot 252");
            writeOam(8, 0xAA);
            assertEquals<u8>(readOamRaw(8), 0xAA, "OAM[8] written during HBlank");
        });

        it("write allowed during Mode 1 (VBlank)", () => {
            initPpu();
            tickPpuDots(144 * 456); // 144 full scanlines → VBlank
            assertPpuMode(PpuMode.VBlank, "Mode 1 at LY=144");
            writeOam(12, 0xCC);
            assertEquals<u8>(readOamRaw(12), 0xCC, "OAM[12] written during VBlank");
        });

        it("write allowed when PPU disabled (LCDC.7=0, disabled from VBlank)", () => {
            initPpu();
            tickPpuDots(144 * 456);              // reach VBlank (only safe window to disable PPU)
            MemoryMap.GBstore<u8>(0xFF40, 0x00); // PPU off — only takes effect in VBlank
            writeOam(16, 0xDD);
            assertEquals<u8>(readOamRaw(16), 0xDD, "OAM[16] written when PPU disabled");
        });

        it("read returns $FF during Mode 2 (OAMScan)", () => {
            initPpu();
            assertPpuMode(PpuMode.OAMScan, "Mode 2 at start");
            primeOam(0, 0x42);
            assertEquals<u8>(readOam(0), 0xFF, "OAM read returns $FF in Mode 2");
        });

        it("read returns $FF during Mode 3 (Transfer)", () => {
            initPpu();
            tickPpuDots(80);
            assertPpuMode(PpuMode.Transfer, "Mode 3 at dot 80");
            primeOam(4, 0x42);
            assertEquals<u8>(readOam(4), 0xFF, "OAM read returns $FF in Mode 3");
        });

        it("read returns real data during Mode 0 (HBlank)", () => {
            initPpu();
            tickPpuDots(252);
            assertPpuMode(PpuMode.HBlank, "Mode 0 at dot 252");
            primeOam(8, 0x42);
            assertEquals<u8>(readOam(8), 0x42, "OAM read returns real data in HBlank");
        });

        it("read returns real data during Mode 1 (VBlank)", () => {
            initPpu();
            tickPpuDots(144 * 456);
            assertPpuMode(PpuMode.VBlank, "Mode 1 at LY=144");
            primeOam(12, 0x42);
            assertEquals<u8>(readOam(12), 0x42, "OAM read returns real data in VBlank");
        });
    });

    describe("VRAM read/write access control", () => {

        // spec_vram_oam_access: VRAM accessible only outside Mode 3 (Transfer).
        // Reads during Mode 3 return $FF; writes during Mode 3 are ignored.

        it("read returns $FF during Mode 3 (Transfer)", () => {
            initPpu();
            tickPpuDots(80);
            assertPpuMode(PpuMode.Transfer, "Mode 3 at dot 80");
            primeVram(0, 0x42);
            assertEquals<u8>(readVram(0), 0xFF, "VRAM read returns $FF in Mode 3");
        });

        it("read returns real data during Mode 2 (OAMScan)", () => {
            initPpu();
            assertPpuMode(PpuMode.OAMScan, "Mode 2 at start");
            primeVram(0, 0x42);
            assertEquals<u8>(readVram(0), 0x42, "VRAM read returns real data in Mode 2");
        });

        it("read returns real data during Mode 0 (HBlank)", () => {
            initPpu();
            tickPpuDots(252);
            assertPpuMode(PpuMode.HBlank, "Mode 0 at dot 252");
            primeVram(0, 0x42);
            assertEquals<u8>(readVram(0), 0x42, "VRAM read returns real data in HBlank");
        });

        it("write ignored during Mode 3 (Transfer)", () => {
            initPpu();
            tickPpuDots(80);
            assertPpuMode(PpuMode.Transfer, "Mode 3 at dot 80");
            primeVram(2, 0x42);
            writeVram(2, 0xBB);
            assertEquals<u8>(readVramRaw(2), 0x42, "VRAM write ignored in Mode 3");
        });

        it("write succeeds during Mode 0 (HBlank)", () => {
            initPpu();
            tickPpuDots(252);
            assertPpuMode(PpuMode.HBlank, "Mode 0 at dot 252");
            writeVram(4, 0xAA);
            assertEquals<u8>(readVramRaw(4), 0xAA, "VRAM write succeeds in HBlank");
        });

        it("write succeeds during Mode 1 (VBlank)", () => {
            initPpu();
            tickPpuDots(144 * 456);
            assertPpuMode(PpuMode.VBlank, "Mode 1 at LY=144");
            writeVram(6, 0xCC);
            assertEquals<u8>(readVramRaw(6), 0xCC, "VRAM write succeeds in VBlank");
        });

        // NOTE: OAM corruption bug (DMG only, Mode 2 + 16-bit reg in $FE00-$FEFF range)
        // is not implemented. Known spec gap.
    });

    // Spec: when LCDC.7 is cleared, LY resets to 0 and PPU stops advancing.
    // Games disable PPU during scene transitions to safely write VRAM without tearing.
    describe("PPU disabled (LCDC.7=0)", () => {

        it("LY resets to 0 when PPU disabled during VBlank", () => {
            initPpu();
            tickPpuDots(144 * 456); // reach VBlank — only safe window to disable PPU
            assertLY(144, "LY=144 at VBlank before disable");
            MemoryMap.GBstore<u8>(0xFF40, 0x00); // disable PPU during VBlank
            assertLY(0, "LY must reset to 0 when PPU disabled");
        });

        it("LY stays at 0 while PPU is disabled (ticking does not advance LY)", () => {
            initPpu();
            tickPpuDots(144 * 456); // reach VBlank — safe to disable
            MemoryMap.GBstore<u8>(0xFF40, 0x00);
            tickPpuDots(456 * 10); // tick through what would be a full frame
            assertLY(0, "LY stays at 0 while PPU disabled");
        });

        it("PPU mode is HBlank (0) while disabled", () => {
            initPpu();
            tickPpuDots(144 * 456); // enter VBlank (safe to disable)
            MemoryMap.GBstore<u8>(0xFF40, 0x00); // disable during VBlank
            assertPpuMode(PpuMode.HBlank, "Mode must be HBlank (0) while PPU disabled");
        });

        it("no VBlank interrupt fires while PPU is disabled", () => {
            initPpu();
            tickPpuDots(144 * 456); // reach VBlank → VBlank interrupt fires
            // Clear IF
            MemoryMap.GBstore<u8>(0xFF0F, 0x00);
            MemoryMap.GBstore<u8>(0xFF40, 0x00); // disable PPU
            tickPpuDots(456 * 12); // tick through another full frame's worth
            const ifReg = MemoryMap.GBload<u8>(0xFF0F);
            assertEquals<u8>(ifReg & 0x01, 0, "no VBlank interrupt while PPU disabled");
        });

        it("VRAM write succeeds while PPU disabled (no mode-3 block)", () => {
            initPpu();
            tickPpuDots(144 * 456); // enter VBlank (safe to disable)
            MemoryMap.GBstore<u8>(0xFF40, 0x00); // disable PPU
            primeVram(0, 0x42);
            MemoryMap.GBstore<u8>(0x8000, 0xBB);
            assertEquals<u8>(readVramRaw(0), 0xBB, "VRAM write succeeds while PPU disabled");
        });

    });

    return true;
}
