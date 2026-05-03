import { Cpu } from "../cpu/cpu";
import { Interrupt } from "../cpu/interrupts";
import { Dma } from "../io/video/dma";
import { Ppu, PpuMode, PpuOamFifo } from "../io/video/ppu";
import { Lcd } from "../io/video/lcd";
import { PixelFifo } from "../io/video/pixelFifo";
import { PpuTransfer } from "../io/video/ppuTransfer";
import { TileCache } from "../io/video/tileCache";
import { Timer } from "../io/timer";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";
import { Cartridge } from "../cartridge";
import { CartridgeType } from "../metadata";
import { MBC } from "../memory/mbc";
import { MBC1 } from "../memory/mbc1";
import {
    GB_VIDEO_START,
    GB_IO_START,
    GB_HIGH_RAM_START,
    CARTRIDGE_ROM_START,
    ROM_BANK_SIZE
} from "../memory/memoryConstants";
import { createSaveState, loadSaveState, SAVESTATE_MAGIC, SAVESTATE_VERSION, SAVESTATE_FIXED_SIZE, isAtFrameBoundary, APU_STATE_SIZE, CGB_STATE_SIZE } from "../savestate";
import { AudioRender } from "../audio/render";
import { PulseChannel, PULSE_CHANNEL_SERIALIZED_SIZE } from "../audio/PulseChannel";
import { WaveChannel, WAVE_CHANNEL_SERIALIZED_SIZE } from "../audio/WaveChannel";
import { NoiseChannel, NOISE_CHANNEL_SERIALIZED_SIZE } from "../audio/NoiseChannel";
import { AudioChannelBase, AudioChannelId } from "../audio/AudioChannelBase";
import { AudioData } from "../audio/AudioData";
import { SoundDataPtr, WavePtr } from "../audio/audioRegisters";
import { AudioRegisterType, getRegisterIndex } from "../audio/audioTypes";
import { describe, it, assertEquals } from "./framework";

function setupClean(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Emulator.Init(false);
    // Place PPU at frame boundary so createSaveState succeeds by default.
    Ppu.currentMode = PpuMode.VBlank;
    Lcd.data.lY = 144;
}

function testHeaderMagic(): void {
    it("magic bytes are 'SVBY' at offset 0", () => {
        setupClean();
        const state = createSaveState();
        assertEquals<u32>(load<u32>(state.dataStart), SAVESTATE_MAGIC, "magic");
    });
}

function testHeaderVersion(): void {
    it("version is 5 at offset 4", () => {
        setupClean();
        const state = createSaveState();
        assertEquals<u16>(load<u16>(state.dataStart + 4), SAVESTATE_VERSION, "version");
        assertEquals<u16>(SAVESTATE_VERSION, 5, "SAVESTATE_VERSION");
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

function testRejectV1(): void {
    it("loadSaveState rejects v1 blob (version=1)", () => {
        setupClean();
        const state = createSaveState();
        store<u16>(state.dataStart + 4, 1); // force version=1
        assert(!loadSaveState(state), "should fail on v1 blob");
    });
}

function testAcceptV2(): void {
    it("loadSaveState accepts v2 blob (no APU block)", () => {
        setupClean();
        const state = createSaveState();
        store<u16>(state.dataStart + 4, 2); // force version=2, APU block ignored
        assert(loadSaveState(state), "should succeed on v2 blob");
    });
}

function testAcceptV3(): void {
    it("loadSaveState accepts v3 blob (no CGB block)", () => {
        setupClean();
        const state = createSaveState();
        store<u16>(state.dataStart + 4, 3); // force v3, CGB block ignored
        assert(loadSaveState(state), "should succeed on v3 blob");
    });
}

function testAcceptV4(): void {
    it("loadSaveState accepts freshly-created v5 blob", () => {
        setupClean();
        const state = createSaveState();
        assertEquals<u16>(load<u16>(state.dataStart + 4), 5, "version=5");
        assert(loadSaveState(state), "should succeed on v5 blob");
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

function testCpuExtraFlags(): void {
    it("round-trips failedLastCondition=true, haltBug=true", () => {
        setupClean();
        Cpu.failedLastCondition = true;
        Cpu.haltBug = true;
        const state = createSaveState();
        Emulator.Init(false);
        assert(!Cpu.failedLastCondition, "pre-load failedLastCondition reset");
        assert(!Cpu.haltBug, "pre-load haltBug reset");
        assert(loadSaveState(state), "load failed");
        assert(Cpu.failedLastCondition, "failedLastCondition=true");
        assert(Cpu.haltBug, "haltBug=true");
    });
    it("round-trips failedLastCondition=false, haltBug=false", () => {
        setupClean();
        Cpu.failedLastCondition = false;
        Cpu.haltBug = false;
        const state = createSaveState();
        Cpu.failedLastCondition = true;
        Cpu.haltBug = true;
        assert(loadSaveState(state), "load failed");
        assert(!Cpu.failedLastCondition, "failedLastCondition=false");
        assert(!Cpu.haltBug, "haltBug=false");
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

function testTimerOverflowPending(): void {
    it("round-trips Timer.overflowPending=true", () => {
        setupClean();
        Timer.overflowPending = true;
        const state = createSaveState();
        Emulator.Init(false);
        assert(!Timer.overflowPending, "pre-load overflowPending reset");
        assert(loadSaveState(state), "load failed");
        assert(Timer.overflowPending, "overflowPending=true");
    });
    it("round-trips Timer.overflowPending=false", () => {
        setupClean();
        Timer.overflowPending = false;
        const state = createSaveState();
        Timer.overflowPending = true;
        assert(loadSaveState(state), "load failed");
        assert(!Timer.overflowPending, "overflowPending=false");
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

function testLcdWindowState(): void {
    it("round-trips Lcd.windowLy=50", () => {
        setupClean();
        Lcd.WindowLyInternal = 50;
        const state = createSaveState();
        Emulator.Init(false);
        assertEquals<u8>(Lcd.WindowLyInternal, 0, "pre-load windowLy reset");
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(Lcd.WindowLyInternal, 50, "windowLy");
    });
    it("round-trips Lcd._windowVisible=true", () => {
        setupClean();
        Lcd.WindowVisibleInternal = true;
        const state = createSaveState();
        Lcd.WindowVisibleInternal = false;
        assert(loadSaveState(state), "load failed");
        assert(Lcd.WindowVisibleInternal, "windowVisible=true");
    });
    it("round-trips Lcd._windowVisible=false", () => {
        setupClean();
        Lcd.WindowVisibleInternal = false;
        const state = createSaveState();
        Lcd.WindowVisibleInternal = true;
        assert(loadSaveState(state), "load failed");
        assert(!Lcd.WindowVisibleInternal, "windowVisible=false");
    });
    it("windowLy increments after NextLine post-load when window visible", () => {
        setupClean();
        // Set up window visible state: LCDC bit5 (window) + bit0 (BG/Win), lY=80, WY=60, WX=20
        Lcd.Store(0xFF40, 0x91 | (1 << 5));
        Lcd.data.lY = 80;
        Lcd.data.windowY = 60;
        Lcd.data.windowX = 20;
        Lcd.WindowVisibleInternal = true;
        Lcd.WindowLyInternal = 7;
        const state = createSaveState();
        Emulator.Init(false);
        assert(loadSaveState(state), "load failed");
        const before: u8 = Lcd.WindowLyInternal;
        Lcd.NextLine();
        assertEquals<u8>(Lcd.WindowLyInternal, before + 1, "windowLy incremented");
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

function testTransientPpuOamFifo(): void {
    it("PpuOamFifo reset on load", () => {
        setupClean();
        const state = createSaveState();
        PpuOamFifo.size = 5;
        PpuOamFifo.head = 2;
        assert(loadSaveState(state), "load failed");
        assertEquals<i32>(PpuOamFifo.size, 0, "size");
        assertEquals<i32>(PpuOamFifo.head, 0, "head");
    });
}

function testTransientPixelFifo(): void {
    it("PixelFifo empty on load", () => {
        setupClean();
        const state = createSaveState();
        PixelFifo.Enqueue(1);
        PixelFifo.Enqueue(2);
        PixelFifo.Enqueue(3);
        PixelFifo.Enqueue(4);
        assert(!PixelFifo.IsEmpty(), "pre-load fifo not empty");
        assert(loadSaveState(state), "load failed");
        assert(PixelFifo.IsEmpty(), "fifo empty after load");
    });
}

function testTransientPpuTransfer(): void {
    it("PpuTransfer reset on load", () => {
        setupClean();
        const state = createSaveState();
        PpuTransfer.state = 4; // Push
        PpuTransfer.lineX = 100;
        PpuTransfer.pushedX = 80;
        assert(loadSaveState(state), "load failed");
        assertEquals<i32>(<i32>PpuTransfer.state, 0, "state=GetTile");
        assertEquals<u8>(PpuTransfer.lineX, 0, "lineX");
        assertEquals<u8>(PpuTransfer.pushedX, 0, "pushedX");
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
        assert(<u32>state.byteLength >= SAVESTATE_FIXED_SIZE, "size >= FIXED_SIZE");
    });
}

function testSizeShrunk(): void {
    it("v2 schema shrinks SAVESTATE_FIXED_SIZE below v1 baseline (49652)", () => {
        // v1 SAVESTATE_FIXED_SIZE was 49652; after removing fifo/sprite fields
        // and compacting layout, new size must be strictly smaller.
        assert(SAVESTATE_FIXED_SIZE < 49652, "fixed size shrunk from v1");
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

// Reproduces the bug where loadSaveState restored MBC1.rom1Bank but left
// MBC.rom1Base (the cached fast-path base used by every CPU opcode fetch)
// pointing at the previously-mapped bank. Symptom: first frame post-load
// rendered correctly, then the CPU started fetching opcodes from the wrong
// ROM bank → wrong tiles in subsequent frames.
function setupMbc1(): void {
    // 32 banks × 16KiB = 512KiB. romSizeByte=4 → RomBankCount=32.
    memory.fill(CARTRIDGE_ROM_START, 0x00, 32 * <i32>ROM_BANK_SIZE);
    MemoryMap.loadedCartridgeRomSize = 32 * ROM_BANK_SIZE;
    Cartridge.Data.cartridgeType = CartridgeType.MBC1;
    Cartridge.Data.romSizeByte = 4;
    Cartridge.Data.ramSizeByte = 0;
    Emulator.Init(false);
    Ppu.currentMode = PpuMode.VBlank;
    Lcd.data.lY = 144;
}

function testMbcRomBaseCacheRestored(): void {
    it("MBC.rom1Base refreshed after load (regression: cached base stale)", () => {
        setupMbc1();
        // Switch to bank 5 (writes to $2000-$3FFF set MBC1.LowRegister).
        MBC.HandleWrite(0x2000, 5);
        assertEquals<u8>(MBC1.rom1Bank, 5, "pre-save rom1Bank");
        const expectedBase: u32 = CARTRIDGE_ROM_START + 5 * ROM_BANK_SIZE;
        assertEquals<u32>(MBC.rom1Base, expectedBase, "pre-save rom1Base");
        const state = createSaveState();
        // Now switch to bank 10 — drifts cached base.
        MBC.HandleWrite(0x2000, 10);
        assertEquals<u32>(MBC.rom1Base, CARTRIDGE_ROM_START + 10 * ROM_BANK_SIZE, "drifted rom1Base");
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(MBC1.rom1Bank, 5, "rom1Bank restored");
        assertEquals<u32>(MBC.rom1Base, expectedBase, "rom1Base re-cached after load");
    });
    it("CPU fetch from $4000-$7FFF reads saved bank, not last-mapped bank", () => {
        setupMbc1();
        // Plant marker bytes at $4000 in banks 5 and 10.
        store<u8>(CARTRIDGE_ROM_START + 5 * ROM_BANK_SIZE, 0x55);
        store<u8>(CARTRIDGE_ROM_START + 10 * ROM_BANK_SIZE, 0xAA);
        MBC.HandleWrite(0x2000, 5);
        assertEquals<u8>(MemoryMap.GBload<u8>(0x4000), 0x55, "pre-save fetch bank 5");
        const state = createSaveState();
        MBC.HandleWrite(0x2000, 10);
        assertEquals<u8>(MemoryMap.GBload<u8>(0x4000), 0xAA, "fetch bank 10 before load");
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(MemoryMap.GBload<u8>(0x4000), 0x55, "fetch bank 5 after load");
    });
}

function testFrameBoundaryVBlank(): void {
    it("createSaveState succeeds in VBlank", () => {
        setupClean();
        Ppu.currentMode = PpuMode.VBlank;
        Lcd.data.lY = 144;
        assert(isAtFrameBoundary(), "isAtFrameBoundary true in VBlank");
        const state = createSaveState();
        assert(state.byteLength > 0, "non-empty save");
    });
}

function testFrameBoundaryTransfer(): void {
    it("createSaveState returns empty in Transfer mid-frame", () => {
        setupClean();
        Ppu.currentMode = PpuMode.Transfer;
        Lcd.data.lY = 80;
        assert(!isAtFrameBoundary(), "isAtFrameBoundary false mid-frame");
        const state = createSaveState();
        assertEquals<i32>(state.byteLength, 0, "empty save");
    });
}

// --- APU savestate tests ---

function bytesEqual(a: Uint8Array, b: Uint8Array, size: u32, label: string): void {
    assertEquals<i32>(a.byteLength, b.byteLength, label + " length");
    for (let i: u32 = 0; i < size; i++) {
        assertEquals<u8>(a[i], b[i], label + " byte " + i.toString());
    }
}

// Channel bytewise roundtrip: serialize orig, deserialize into fresh, re-serialize fresh,
// assert byte blobs match. Validates pairing without touching private fields.
function channelRoundTrip(
    orig: AudioChannelBase, fresh: AudioChannelBase, size: u32, label: string
): void {
    const a = new Uint8Array(size);
    const b = new Uint8Array(size);
    orig.serialize(a.dataStart);
    fresh.deserialize(a.dataStart);
    fresh.serialize(b.dataStart);
    bytesEqual(a, b, size, label);
}

function testPulseChannelRoundTrip(): void {
    it("PulseChannel serialize/deserialize is lossless", () => {
        const orig = new PulseChannel(AudioChannelId.Channel1);
        orig.LengthTimer = 17;
        orig.HandleEnvelopeEvent(0xA3); // vol=0xA, pace=3, dir up
        orig.HandleSweepEvent(0x5B);     // pace=5, negate, step=3
        orig.setDutyCycle(3);
        orig.PeriodLow = 0x33;
        orig.PeriodHigh = 0x07;
        orig.trigger();
        orig.LengthEnabled = true;

        const fresh = new PulseChannel(AudioChannelId.Channel1);
        channelRoundTrip(orig, fresh, PULSE_CHANNEL_SERIALIZED_SIZE, "pulse");
    });
}

function testWaveChannelRoundTrip(): void {
    it("WaveChannel serialize/deserialize is lossless", () => {
        const orig = WaveChannel.Create();
        orig.LengthTimer = 42;
        orig.Level = 2; // Half
        orig.setDacOn(true);
        orig.PeriodLow = 0x11;
        orig.PeriodHigh = 0x02;
        orig.trigger();
        orig.LengthEnabled = true;

        const fresh = WaveChannel.Create();
        channelRoundTrip(orig, fresh, WAVE_CHANNEL_SERIALIZED_SIZE, "wave");
    });
}

function testNoiseChannelRoundTrip(): void {
    it("NoiseChannel serialize/deserialize is lossless", () => {
        const orig = new NoiseChannel(AudioChannelId.Channel4);
        orig.LengthTimer = 9;
        orig.HandleEnvelopeEvent(0xF7); // vol=0xF, pace=7, dir up
        orig.ShortMode = true;
        orig.Lsfr = 0x7FFF;
        orig.setLsfrClock(3, 2);
        orig.trigger();
        orig.LengthEnabled = true;

        const fresh = new NoiseChannel(AudioChannelId.Channel4);
        channelRoundTrip(orig, fresh, NOISE_CHANNEL_SERIALIZED_SIZE, "noise");
    });
}

function testApuStateSize(): void {
    it("APU_STATE_SIZE matches sum of channel sizes + global (262 bytes)", () => {
        const expected: u32 = 2 * PULSE_CHANNEL_SERIALIZED_SIZE
            + WAVE_CHANNEL_SERIALIZED_SIZE
            + NOISE_CHANNEL_SERIALIZED_SIZE
            + 25;
        assertEquals<u32>(APU_STATE_SIZE, expected, "APU_STATE_SIZE");
    });
}

function testSaveStateIncludesApuBlock(): void {
    it("v4 blob size includes APU + CGB block appended after ext RAM", () => {
        setupClean();
        const state = createSaveState();
        // ROM-only cart: RamBankCount=0 → extRamSize=0. Size = FIXED + APU + CGB.
        assertEquals<i32>(state.byteLength, <i32>(SAVESTATE_FIXED_SIZE + APU_STATE_SIZE + CGB_STATE_SIZE), "total size");
    });
}

function testApuRenderStateRoundTrip(): void {
    it("AudioRender sampleIndex/initialCycles/volumes round-trip", () => {
        setupClean();
        const sampleIdx: u64 = 0x0000BEEF12345678;
        const initCyc: u64 = 0x00001122334455;
        AudioRender.sampleIndex = sampleIdx;
        AudioRender.initialCycles = initCyc;
        AudioRender.LeftVolume = 0.625;
        AudioRender.RightVolume = 0.875;
        AudioRender.AudioOn = true;
        const state = createSaveState();

        AudioRender.sampleIndex = 0;
        AudioRender.initialCycles = 0;
        AudioRender.LeftVolume = 1.0;
        AudioRender.RightVolume = 1.0;
        AudioRender.AudioOn = false;

        assert(loadSaveState(state), "load failed");
        assertEquals<u64>(AudioRender.sampleIndex, sampleIdx, "sampleIndex");
        assertEquals<u64>(AudioRender.initialCycles, initCyc, "initialCycles");
        assertEquals<f32>(AudioRender.LeftVolume, 0.625, "LeftVolume");
        assertEquals<f32>(AudioRender.RightVolume, 0.875, "RightVolume");
        assert(AudioRender.AudioOn, "AudioOn");
    });
}

function testApuNoiseLsfrRoundTrip(): void {
    it("NoiseChannel.Lsfr/ShortMode round-trip through savestate", () => {
        setupClean();
        AudioRender.channel4.Lsfr = 0x2A5B;
        AudioRender.channel4.ShortMode = true;
        const state = createSaveState();
        AudioRender.channel4.Lsfr = 0;
        AudioRender.channel4.ShortMode = false;
        assert(loadSaveState(state), "load failed");
        assertEquals<u16>(AudioRender.channel4.Lsfr, 0x2A5B, "Lsfr");
        assert(AudioRender.channel4.ShortMode, "ShortMode");
    });
}

function testApuWaveLevelRoundTrip(): void {
    it("WaveChannel.Level round-trips through savestate", () => {
        setupClean();
        AudioRender.channel3.Level = 2; // Half
        const state = createSaveState();
        AudioRender.channel3.Level = 0;
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(<u8>AudioRender.channel3.Level, 2, "Level=Half");
    });
}

function testApuWaveRamRoundTrip(): void {
    it("Wave RAM ($FF30-$FF3F) re-syncs to AudioData.registers after load", () => {
        setupClean();
        // Plant distinctive bytes into wave RAM (IO memory) and the render-side mirror.
        for (let i: i32 = 0; i < 16; i++) {
            const b: u8 = <u8>(0xA0 ^ i);
            store<u8>(WavePtr + i, b);
        }
        // Sync mirror so it matches IO before save (mimics steady-state runtime).
        memory.copy(AudioData.registers.dataStart, SoundDataPtr, 0x30);
        const state = createSaveState();
        // Wipe both sides to detect missing re-sync.
        memory.fill(WavePtr, 0, 16);
        AudioData.registers.fill(0, getRegisterIndex(AudioRegisterType.WaveStart), getRegisterIndex(AudioRegisterType.WaveStart) + 16);
        assert(loadSaveState(state), "load failed");
        const waveBase: i32 = getRegisterIndex(AudioRegisterType.WaveStart);
        for (let i: i32 = 0; i < 16; i++) {
            const expected: u8 = <u8>(0xA0 ^ i);
            assertEquals<u8>(load<u8>(WavePtr + i), expected, "IO wave byte " + i.toString());
            assertEquals<u8>(AudioData.registers[waveBase + i], expected, "register mirror wave byte " + i.toString());
        }
    });
}

function testApuPanningRoundTrip(): void {
    it("NR51 panning re-syncs to AudioData.registers after load", () => {
        setupClean();
        // NR51 IO byte = $FF25; matching mirror index = NR51 - Offset = 0x15.
        const nr51Index: i32 = getRegisterIndex(AudioRegisterType.NR51_Panning);
        store<u8>(SoundDataPtr + nr51Index, 0xA5);
        AudioData.registers[nr51Index] = 0xA5;
        const state = createSaveState();
        store<u8>(SoundDataPtr + nr51Index, 0);
        AudioData.registers[nr51Index] = 0;
        assert(loadSaveState(state), "load failed");
        assertEquals<u8>(AudioData.registers[nr51Index], 0xA5, "NR51 mirror");
    });
}

function testApuV2BlobSkipsDeserialize(): void {
    it("v2 blob does NOT restore APU state (backward compat)", () => {
        setupClean();
        AudioRender.channel4.Lsfr = 0x1234;
        const state = createSaveState();
        store<u16>(state.dataStart + 4, 2); // force v2
        AudioRender.channel4.Lsfr = 0xABCD;
        assert(loadSaveState(state), "load failed");
        // v2 load must NOT overwrite runtime APU state.
        assertEquals<u16>(AudioRender.channel4.Lsfr, 0xABCD, "Lsfr untouched by v2 load");
    });
}

function testIsAtFrameBoundary(): void {
    it("isAtFrameBoundary true iff VBlank or lY>=144", () => {
        setupClean();
        Ppu.currentMode = PpuMode.OAMScan;
        Lcd.data.lY = 0;
        assert(!isAtFrameBoundary(), "OAMScan lY=0");
        Ppu.currentMode = PpuMode.HBlank;
        Lcd.data.lY = 50;
        assert(!isAtFrameBoundary(), "HBlank lY=50");
        Ppu.currentMode = PpuMode.Transfer;
        Lcd.data.lY = 143;
        assert(!isAtFrameBoundary(), "Transfer lY=143");
        Ppu.currentMode = PpuMode.VBlank;
        Lcd.data.lY = 144;
        assert(isAtFrameBoundary(), "VBlank lY=144");
        Ppu.currentMode = PpuMode.OAMScan;
        Lcd.data.lY = 150;
        assert(isAtFrameBoundary(), "OAMScan lY=150");
    });
}

export function testSaveState(): boolean {
    describe("SaveState - Header", () => {
        testHeaderMagic();
        testHeaderVersion();
        testTooShort();
        testBadMagic();
        testBadVersion();
        testRejectV1();
        testAcceptV2();
        testAcceptV3();
        testAcceptV4();
        testSizeMinimum();
        testSizeShrunk();
    });
    describe("SaveState - CPU", () => {
        testCpuRegisters();
        testCpuFlags();
        testCpuExtraFlags();
        testCycleCount();
    });
    describe("SaveState - Timer", () => {
        testTimer();
        testTimerOverflowPending();
    });
    describe("SaveState - PPU", () => {
        testPpu();
    });
    describe("SaveState - Lcd window state", () => {
        testLcdWindowState();
    });
    describe("SaveState - DMA", () => {
        testDma();
    });
    describe("SaveState - Transient state", () => {
        testTransientPpuOamFifo();
        testTransientPixelFifo();
        testTransientPpuTransfer();
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
    describe("SaveState - MBC cache", () => {
        testMbcRomBaseCacheRestored();
    });
    describe("SaveState - Frame boundary", () => {
        testIsAtFrameBoundary();
        testFrameBoundaryVBlank();
        testFrameBoundaryTransfer();
    });
    describe("SaveState - APU", () => {
        testApuStateSize();
        testPulseChannelRoundTrip();
        testWaveChannelRoundTrip();
        testNoiseChannelRoundTrip();
        testSaveStateIncludesApuBlock();
        testApuRenderStateRoundTrip();
        testApuNoiseLsfrRoundTrip();
        testApuWaveLevelRoundTrip();
        testApuWaveRamRoundTrip();
        testApuPanningRoundTrip();
        testApuV2BlobSkipsDeserialize();
    });
    return true;
}
