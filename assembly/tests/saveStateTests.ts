import { Cpu } from "../cpu/cpu";
import { Interrupt } from "../cpu/interrupts";
import { Dma } from "../io/video/dma";
import { Ppu, PpuMode } from "../io/video/ppu";
import { Lcd } from "../io/video/lcd";
import { TileCache } from "../io/video/tileCache";
import { Timer } from "../io/timer";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";
import {
    GB_VIDEO_START,
    GB_IO_START,
    GB_HIGH_RAM_START,
    CARTRIDGE_ROM_START
} from "../memory/memoryConstants";
import { createSaveState, loadSaveState, SAVESTATE_MAGIC, SAVESTATE_VERSION } from "../savestate";
import { describe, it, assertEquals } from "./framework";

function setupClean(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Emulator.Init(false);
}

function testHeaderMagic(): void {
    it("magic bytes are 'SVBY' at offset 0", () => {
        setupClean();
        const state = createSaveState();
        assertEquals<u32>(load<u32>(state.dataStart), SAVESTATE_MAGIC, "magic");
    });
}

function testHeaderVersion(): void {
    it("version is 1 at offset 4", () => {
        setupClean();
        const state = createSaveState();
        assertEquals<u16>(load<u16>(state.dataStart + 4), SAVESTATE_VERSION, "version");
    });
}

function testTooShort(): void {
    it("loadSaveState rejects data shorter than header", () => {
        const tiny = new Uint8Array(4);
        assert(!loadSaveState(tiny), "should fail on too-short data");
    });
}

function testBadMagic(): void {
    it("loadSaveState rejects wrong magic", () => {
        setupClean();
        const state = createSaveState();
        store<u32>(state.dataStart, 0xDEADBEEF);
        assert(!loadSaveState(state), "should fail on bad magic");
    });
}

function testBadVersion(): void {
    it("loadSaveState rejects unsupported version", () => {
        setupClean();
        const state = createSaveState();
        store<u16>(state.dataStart + 4, 0xFFFF);
        assert(!loadSaveState(state), "should fail on bad version");
    });
}

function testCpuRegisters(): void {
    it("round-trips AF/BC/DE/HL/SP/PC", () => {
        setupClean();
        Cpu.AF = 0x1234;
        Cpu.BC = 0x5678;
        Cpu.DE = 0x9ABC;
        Cpu.HL = 0xDEF0;
        Cpu.StackPointer = 0xFFF0;
        Cpu.ProgramCounter = 0x0150;
        const state = createSaveState();
        Emulator.Init(false);
        assertEquals<u16>(Cpu.AF, 0x01B0, "AF reset");
        assert(loadSaveState(state), "load failed");
        assertEquals<u16>(Cpu.AF, 0x1234, "AF");
        assertEquals<u16>(Cpu.BC, 0x5678, "BC");
        assertEquals<u16>(Cpu.DE, 0x9ABC, "DE");
        assertEquals<u16>(Cpu.HL, 0xDEF0, "HL");
        assertEquals<u16>(Cpu.StackPointer, 0xFFF0, "SP");
        assertEquals<u16>(Cpu.ProgramCounter, 0x0150, "PC");
    });
}

function testCpuFlags(): void {
    it("round-trips isHalted/isStopped/isEnablingIME/masterEnabled", () => {
        setupClean();
        Cpu.isHalted = true;
        Cpu.isStopped = false;
        Cpu.isEnablingIME = true;
        Interrupt.masterEnabled = true;
        const state = createSaveState();
        Emulator.Init(false);
        assert(loadSaveState(state), "load failed");
        assert(Cpu.isHalted, "isHalted");
        assert(!Cpu.isStopped, "isStopped");
        assert(Cpu.isEnablingIME, "isEnablingIME");
        assert(Interrupt.masterEnabled, "masterEnabled");
    });
}

function testCycleCount(): void {
    it("round-trips CycleCount", () => {
        setupClean();
        Cpu.CycleCount = 0x0000BEEF12345678;
        const state = createSaveState();
        Emulator.Init(false);
        assertEquals<u64>(Cpu.CycleCount, 0, "CycleCount reset");
        assert(loadSaveState(state), "load failed");
        assertEquals<u64>(Cpu.CycleCount, 0x0000BEEF12345678, "CycleCount");
    });
}

function testTimer(): void {
    it("round-trips timer internalDiv/Tima/Tma/Tac", () => {
        setupClean();
        Timer.internalDiv = 0x1234;
        Timer.Tima = 0xAB;
        Timer.Tma = 0xCD;
        Timer.Tac = 0x05;
        const state = createSaveState();
        Emulator.Init(false);
        assert(loadSaveState(state), "load failed");
        assertEquals<u16>(Timer.internalDiv, 0x1234, "internalDiv");
        assertEquals<u8>(Timer.Tima, 0xAB, "Tima");
        assertEquals<u8>(Timer.Tma, 0xCD, "Tma");
        assertEquals<u8>(Timer.Tac, 0x05, "Tac");
    });
}

function testPpu(): void {
    it("round-trips PPU mode/dot/frame", () => {
        setupClean();
        Ppu.currentMode = PpuMode.HBlank;
        Ppu.currentDot = 0x01F0;
        Ppu.currentFrame = 42;
        const state = createSaveState();
        Emulator.Init(false);
        assert(loadSaveState(state), "load failed");
        assertEquals<i32>(Ppu.currentMode as i32, PpuMode.HBlank as i32, "mode");
        assertEquals<u16>(Ppu.currentDot, 0x01F0, "dot");
        assertEquals<u32>(Ppu.currentFrame, 42, "frame");
    });
}

function testDma(): void {
    it("round-trips DMA active/offset/value/startDelay", () => {
        setupClean();
        Dma.active = true;
        Dma.offset = 0x42;
        Dma.value = 0xC0;
        Dma.startDelay = 1;
        const state = createSaveState();
        Emulator.Init(false);
        assert(loadSaveState(state), "load failed");
        assert(Dma.active, "active");
        assertEquals<u8>(Dma.offset, 0x42, "offset");
        assertEquals<u8>(Dma.value, 0xC0, "value");
        assertEquals<u8>(Dma.startDelay, 1, "startDelay");
    });
}

function testVram(): void {
    it("round-trips VRAM content", () => {
        setupClean();
        store<u8>(GB_VIDEO_START + 0, 0xAA);
        store<u8>(GB_VIDEO_START + 1, 0xBB);
        store<u8>(GB_VIDEO_START + 0x1FFF, 0xCC);
        const state = createSaveState();
        store<u8>(GB_VIDEO_START + 0, 0);
        store<u8>(GB_VIDEO_START + 1, 0);
        store<u8>(GB_VIDEO_START + 0x1FFF, 0);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(load<u8>(GB_VIDEO_START + 0), 0xAA, "VRAM[0]");
        assertEquals<u8>(load<u8>(GB_VIDEO_START + 1), 0xBB, "VRAM[1]");
        assertEquals<u8>(load<u8>(GB_VIDEO_START + 0x1FFF), 0xCC, "VRAM[0x1FFF]");
    });
}

function testWram(): void {
    it("round-trips WRAM content", () => {
        setupClean();
        MemoryMap.GBstore<u8>(0xC000, 0xAB);
        MemoryMap.GBstore<u8>(0xC001, 0xCD);
        const state = createSaveState();
        MemoryMap.GBstore<u8>(0xC000, 0x00);
        MemoryMap.GBstore<u8>(0xC001, 0x00);
        assertEquals<u8>(MemoryMap.GBload<u8>(0xC000), 0, "WRAM zeroed");
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(MemoryMap.GBload<u8>(0xC000), 0xAB, "WRAM[0xC000]");
        assertEquals<u8>(MemoryMap.GBload<u8>(0xC001), 0xCD, "WRAM[0xC001]");
    });
}

function testHram(): void {
    it("round-trips HRAM content", () => {
        setupClean();
        store<u8>(GB_HIGH_RAM_START + 0, 0x12);
        store<u8>(GB_HIGH_RAM_START + 0x7E, 0x34);
        const state = createSaveState();
        store<u8>(GB_HIGH_RAM_START + 0, 0);
        store<u8>(GB_HIGH_RAM_START + 0x7E, 0);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(load<u8>(GB_HIGH_RAM_START + 0), 0x12, "HRAM[0]");
        assertEquals<u8>(load<u8>(GB_HIGH_RAM_START + 0x7E), 0x34, "HRAM[0x7E]");
    });
}

function testIo(): void {
    it("round-trips IO region content", () => {
        setupClean();
        store<u8>(GB_IO_START + 0x10, 0xBE);
        store<u8>(GB_IO_START + 0x20, 0xEF);
        const state = createSaveState();
        store<u8>(GB_IO_START + 0x10, 0);
        store<u8>(GB_IO_START + 0x20, 0);
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(load<u8>(GB_IO_START + 0x10), 0xBE, "IO[0x10]");
        assertEquals<u8>(load<u8>(GB_IO_START + 0x20), 0xEF, "IO[0x20]");
    });
}

function testSizeMinimum(): void {
    it("createSaveState returns at least FIXED_SIZE bytes for ROM-only cart", () => {
        setupClean();
        const state = createSaveState();
        assert(state.byteLength >= 49652, "size >= FIXED_SIZE");
    });
}

function testTileCacheRebuildOnLoad(): void {
    it("TileCache rebuilt from VRAM after loadSaveState", () => {
        setupClean();
        // lo=0xAA hi=0x55: pixel 0 = color 1, pixel 1 = color 2 (alternating)
        store<u8>(GB_VIDEO_START + 0, 0xAA);
        store<u8>(GB_VIDEO_START + 1, 0x55);
        TileCache.decode(0x8000);
        assertEquals<u8>(TileCache.data[0], 1, "pre-save cache pixel 0");
        assertEquals<u8>(TileCache.data[1], 2, "pre-save cache pixel 1");
        const state = createSaveState();
        // wipe VRAM and cache to simulate different in-memory state
        store<u8>(GB_VIDEO_START + 0, 0);
        store<u8>(GB_VIDEO_START + 1, 0);
        TileCache.decode(0x8000);
        assertEquals<u8>(TileCache.data[0], 0, "cache wiped");
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(load<u8>(GB_VIDEO_START), 0xAA, "VRAM restored");
        assertEquals<u8>(TileCache.data[0], 1, "cache pixel 0 after load");
        assertEquals<u8>(TileCache.data[1], 2, "cache pixel 1 after load");
    });
}

function testLcdCacheBgTileMap(): void {
    it("round-trips Lcd.BgTileMapBaseAddress after load", () => {
        setupClean();
        // LCDC = 0x88: LCD enabled (bit7) + BGTileMapArea=high (bit3)
        // This makes _bgTileMapBaseAddress = MAP_BASE_HI = GB_VIDEO_START + 0x1C00
        Lcd.Store(0xFF40, 0x88);
        const expectedMap: u32 = GB_VIDEO_START + 0x1C00;
        assertEquals<u32>(Lcd.BgTileMapBaseAddress, expectedMap, "pre-save BgTileMapBaseAddress");
        const state = createSaveState();
        Emulator.Init(false); // resets cache to MAP_BASE_LO
        assert(Lcd.BgTileMapBaseAddress != expectedMap, "cache reset check");
        assert(loadSaveState(state), "load failed");
        assertEquals<u32>(Lcd.BgTileMapBaseAddress, expectedMap, "BgTileMapBaseAddress after load");
    });
}

function testLcdCacheTileBase(): void {
    it("round-trips Lcd.TilesBaseAddress after load", () => {
        setupClean();
        // LCDC = 0x80: LCD enabled (bit7), bit4=0 → TilesBaseAddress = TILE_BASE_HI = GB_VIDEO_START + 0x800
        Lcd.Store(0xFF40, 0x80);
        const expectedTiles: u32 = GB_VIDEO_START + 0x800;
        assertEquals<u32>(Lcd.TilesBaseAddress, expectedTiles, "pre-save TilesBaseAddress");
        const state = createSaveState();
        Emulator.Init(false); // resets cache to TILE_BASE_LO
        assert(Lcd.TilesBaseAddress != expectedTiles, "cache reset check");
        assert(loadSaveState(state), "load failed");
        assertEquals<u32>(Lcd.TilesBaseAddress, expectedTiles, "TilesBaseAddress after load");
    });
}

export function testSaveState(): boolean {
    describe("SaveState - Header", () => {
        testHeaderMagic();
        testHeaderVersion();
        testTooShort();
        testBadMagic();
        testBadVersion();
        testSizeMinimum();
    });
    describe("SaveState - CPU", () => {
        testCpuRegisters();
        testCpuFlags();
        testCycleCount();
    });
    describe("SaveState - Timer", () => {
        testTimer();
    });
    describe("SaveState - PPU", () => {
        testPpu();
    });
    describe("SaveState - DMA", () => {
        testDma();
    });
    describe("SaveState - Memory", () => {
        testVram();
        testWram();
        testHram();
        testIo();
    });
    describe("SaveState - TileCache", () => {
        testTileCacheRebuildOnLoad();
    });
    describe("SaveState - Lcd cache", () => {
        testLcdCacheBgTileMap();
        testLcdCacheTileBase();
    });
    return true;
}
