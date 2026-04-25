import { Cartridge } from "../cartridge";
import { Emulator } from "../emulator";
import { Lcd } from "../io/video/lcd";
import { Dma } from "../io/video/dma";
import { Ppu, PpuMode } from "../io/video/ppu";
import { CgbState } from "../cgbState";
import { CgbIoRegs } from "../io/cgbIoRegs";
import { MemoryMap } from "../memory/memoryMap";
import { CGBMode } from "../metadata";
import {
    CARTRIDGE_ROM_START,
    GB_CGB_PALETTE_RAM_START,
    GB_CGB_PALETTE_RAM_SIZE,
} from "../memory/memoryConstants";
import { createSaveState, loadSaveState, SAVESTATE_VERSION } from "../savestate";
import { describe, it, assertEquals } from "./framework";

function setupCgb(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, CGBMode.CGBOnly as u8);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Cartridge.Data.cgbFlag = CGBMode.CGBOnly as u8;
    Emulator.Init(false);
    Ppu.currentMode = PpuMode.VBlank;
    Lcd.data.lY = 144;
}

function setupDmg(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, 0x00);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Cartridge.Data.cgbFlag = 0x00;
    Emulator.Init(false);
    Ppu.currentMode = PpuMode.VBlank;
    Lcd.data.lY = 144;
}

function testVersionIsFour(): void {
    it("SAVESTATE_VERSION bumped to 4", () => {
        assertEquals<u16>(SAVESTATE_VERSION, 4, "version=4");
    });
}

function testPaletteRamRoundTrip(): void {
    it("BG palette RAM round-trips", () => {
        setupCgb();
        store<u8>(GB_CGB_PALETTE_RAM_START + 0, 0xAA);
        store<u8>(GB_CGB_PALETTE_RAM_START + 1, 0x7F);
        store<u8>(GB_CGB_PALETTE_RAM_START + 63, 0x12);
        const state = createSaveState();
        store<u8>(GB_CGB_PALETTE_RAM_START + 0, 0);
        store<u8>(GB_CGB_PALETTE_RAM_START + 1, 0);
        store<u8>(GB_CGB_PALETTE_RAM_START + 63, 0);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 0), 0xAA, "BG[0]");
        assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 1), 0x7F, "BG[1]");
        assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 63), 0x12, "BG[63]");
    });
    it("OBJ palette RAM round-trips", () => {
        setupCgb();
        store<u8>(GB_CGB_PALETTE_RAM_START + 64, 0x33);
        store<u8>(GB_CGB_PALETTE_RAM_START + 127, 0xCD);
        const state = createSaveState();
        store<u8>(GB_CGB_PALETTE_RAM_START + 64, 0);
        store<u8>(GB_CGB_PALETTE_RAM_START + 127, 0);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 64), 0x33, "OBJ[0]");
        assertEquals<u8>(load<u8>(GB_CGB_PALETTE_RAM_START + 127), 0xCD, "OBJ[63]");
    });
}

function testVramBankRoundTrip(): void {
    it("VBK current bank round-trips", () => {
        setupCgb();
        Lcd.Store(0xFF4F, 1);
        assertEquals<u32>(CgbState.vramBank, 1, "pre-save vramBank=1");
        const state = createSaveState();
        Lcd.Store(0xFF4F, 0);
        assertEquals<u32>(CgbState.vramBank, 0, "vramBank=0 before load");
        assert(loadSaveState(state), "load failed");
        assertEquals<u32>(CgbState.vramBank, 1, "vramBank restored");
    });
}

function testWramBankRoundTrip(): void {
    it("SVBK current bank round-trips", () => {
        setupCgb();
        MemoryMap.GBstore<u8>(0xFF70, 5);
        assertEquals<u32>(CgbState.wramBank, 5, "pre-save wramBank=5");
        const state = createSaveState();
        MemoryMap.GBstore<u8>(0xFF70, 1);
        assertEquals<u32>(CgbState.wramBank, 1, "wramBank=1 before load");
        assert(loadSaveState(state), "load failed");
        assertEquals<u32>(CgbState.wramBank, 5, "wramBank restored");
    });
}

function testBcpsOcpsRoundTrip(): void {
    it("BCPS index+autoincrement round-trips", () => {
        setupCgb();
        Lcd.Store(0xFF68, 0x95); // index=0x15, auto-increment=1
        const state = createSaveState();
        Lcd.Store(0xFF68, 0x00);
        assert(loadSaveState(state), "load failed");
        // BCPS reads back with bit 6 forced high.
        assertEquals<u8>(Lcd.Load(0xFF68), 0x95 | 0x40, "BCPS read");
    });
    it("OCPS index+autoincrement round-trips", () => {
        setupCgb();
        Lcd.Store(0xFF6A, 0x83);
        const state = createSaveState();
        Lcd.Store(0xFF6A, 0x00);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(Lcd.Load(0xFF6A), 0x83 | 0x40, "OCPS read");
    });
}

function testDoubleSpeedRoundTrip(): void {
    it("doubleSpeed flag and shift round-trip", () => {
        setupCgb();
        CgbState.setDoubleSpeed(true);
        const state = createSaveState();
        CgbState.setDoubleSpeed(false);
        assertEquals<u8>(CgbState.doubleSpeedShift, 0, "shift=0 before load");
        assert(loadSaveState(state), "load failed");
        assertEquals<boolean>(CgbState.doubleSpeed, true, "doubleSpeed=true");
        assertEquals<u8>(CgbState.doubleSpeedShift, 1, "shift=1");
    });
}

function testKey1RoundTrip(): void {
    it("KEY1 prepare bit round-trips", () => {
        setupCgb();
        CgbState.setKey1(0x01);
        const state = createSaveState();
        CgbState.setKey1(0x00);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(CgbState.key1, 0x01, "KEY1=0x01");
    });
}

function testHdmaRegistersRoundTrip(): void {
    it("HDMA1-4 source/dest round-trip", () => {
        setupCgb();
        Dma.Store(0xFF51, 0x12);
        Dma.Store(0xFF52, 0xA0);
        Dma.Store(0xFF53, 0x1F);
        Dma.Store(0xFF54, 0x30);
        const state = createSaveState();
        Dma.Store(0xFF51, 0x00);
        Dma.Store(0xFF52, 0x00);
        Dma.Store(0xFF53, 0x00);
        Dma.Store(0xFF54, 0x00);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(Dma.hdma1, 0x12, "hdma1");
        assertEquals<u8>(Dma.hdma2, 0xA0, "hdma2");
        assertEquals<u8>(Dma.hdma3, 0x1F, "hdma3");
        assertEquals<u8>(Dma.hdma4, 0x30, "hdma4");
    });
}

function testHdmaInflightRoundTrip(): void {
    it("HBlank HDMA in-flight round-trips", () => {
        setupCgb();
        Dma.hdmaSrc = 0x4444;
        Dma.hdmaDst = 0x8800;
        Dma.hdmaBlocksRemaining = 4;
        Dma.hdmaHBlankMode = true;
        Dma.hdmaActive = true;
        const state = createSaveState();
        Dma.hdmaSrc = 0;
        Dma.hdmaDst = 0x8000;
        Dma.hdmaBlocksRemaining = 0;
        Dma.hdmaHBlankMode = false;
        Dma.hdmaActive = false;
        assert(loadSaveState(state), "load failed");
        assertEquals<u16>(Dma.hdmaSrc, 0x4444, "hdmaSrc");
        assertEquals<u16>(Dma.hdmaDst, 0x8800, "hdmaDst");
        assertEquals<u8>(Dma.hdmaBlocksRemaining, 4, "blocksRemaining");
        assertEquals<boolean>(Dma.hdmaHBlankMode, true, "hblankMode");
        assertEquals<boolean>(Dma.hdmaActive, true, "active");
    });
}

function testCgbIoRegsRoundTrip(): void {
    it("KEY0 round-trips", () => {
        setupCgb();
        // KEY0 is locked once boot ROM disabled; force boot-rom-active for write.
        const wasBoot = MemoryMap.useBootRom;
        MemoryMap.useBootRom = true;
        CgbIoRegs.Store(0xFF4C, 0x04);
        MemoryMap.useBootRom = wasBoot;
        const state = createSaveState();
        CgbIoRegs._key0 = 0x00;
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(CgbIoRegs._key0, 0x04, "KEY0");
    });
    it("OPRI round-trips", () => {
        setupCgb();
        CgbIoRegs.Store(0xFF6C, 0x01);
        const state = createSaveState();
        CgbIoRegs._opri = 0x00;
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(CgbIoRegs._opri, 0x01, "OPRI");
    });
    it("RP round-trips", () => {
        setupCgb();
        CgbIoRegs.Store(0xFF56, 0xC1);
        const state = createSaveState();
        CgbIoRegs._rp = 0x00;
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(CgbIoRegs._rp, 0xC1, "RP");
    });
    it("FF72-FF75 round-trip", () => {
        setupCgb();
        CgbIoRegs.Store(0xFF72, 0xAB);
        CgbIoRegs.Store(0xFF73, 0xCD);
        CgbIoRegs.Store(0xFF74, 0xEF);
        CgbIoRegs.Store(0xFF75, 0x70);
        const state = createSaveState();
        CgbIoRegs._ff72 = 0;
        CgbIoRegs._ff73 = 0;
        CgbIoRegs._ff74 = 0;
        CgbIoRegs._ff75 = 0;
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(CgbIoRegs._ff72, 0xAB, "FF72");
        assertEquals<u8>(CgbIoRegs._ff73, 0xCD, "FF73");
        assertEquals<u8>(CgbIoRegs._ff74, 0xEF, "FF74");
        assertEquals<u8>(CgbIoRegs._ff75, 0x70, "FF75");
    });
}

function testV3FallbackResetsCgb(): void {
    it("v3 blob loaded on CGB cart resets CGB state to power-on", () => {
        setupCgb();
        const state = createSaveState();
        // Force version=3: loader must ignore CGB block and reset CGB state.
        store<u16>(state.dataStart + 4, 3);
        // Mutate runtime CGB state so reset is observable.
        Lcd.Store(0xFF4F, 1);
        MemoryMap.GBstore<u8>(0xFF70, 5);
        CgbState.setDoubleSpeed(true);
        CgbState.setKey1(0x01);
        Dma.hdmaActive = true;
        Dma.hdmaBlocksRemaining = 7;
        Dma.hdmaHBlankMode = true;
        assert(loadSaveState(state), "load failed");
        assertEquals<u32>(CgbState.vramBank, 0, "vramBank reset");
        assertEquals<u32>(CgbState.wramBank, 1, "wramBank reset");
        assertEquals<boolean>(CgbState.doubleSpeed, false, "doubleSpeed reset");
        assertEquals<u8>(CgbState.key1, 0, "key1 reset");
        assertEquals<boolean>(Dma.hdmaActive, false, "hdmaActive reset");
        assertEquals<u8>(Dma.hdmaBlocksRemaining, 0, "blocks reset");
        assertEquals<boolean>(Dma.hdmaHBlankMode, false, "hblankMode reset");
    });
}

function testV4OnDmgLoads(): void {
    it("v4 blob saved on DMG cart loads cleanly", () => {
        setupDmg();
        const state = createSaveState();
        assert(loadSaveState(state), "load failed");
        assertEquals<boolean>(CgbState.isCgbMode, false, "stays DMG mode");
    });
}

export function testCgbSaveState(): boolean {
    describe("SaveState - CGB version", () => {
        testVersionIsFour();
    });
    describe("SaveState - CGB palette RAM", () => {
        testPaletteRamRoundTrip();
    });
    describe("SaveState - CGB banks", () => {
        testVramBankRoundTrip();
        testWramBankRoundTrip();
    });
    describe("SaveState - CGB BCPS/OCPS", () => {
        testBcpsOcpsRoundTrip();
    });
    describe("SaveState - CGB speed", () => {
        testDoubleSpeedRoundTrip();
        testKey1RoundTrip();
    });
    describe("SaveState - CGB HDMA", () => {
        testHdmaRegistersRoundTrip();
        testHdmaInflightRoundTrip();
    });
    describe("SaveState - CGB IO regs", () => {
        testCgbIoRegsRoundTrip();
    });
    describe("SaveState - CGB version compat", () => {
        testV3FallbackResetsCgb();
        testV4OnDmgLoads();
    });
    Cartridge.Data.cgbFlag = 0x00;
    CgbState.setIsCGB(false);
    return true;
}
