import { Cpu } from "../cpu/cpu";
import { Interrupt, IntType } from "../cpu/interrupts";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";
import { Ppu, PpuMode } from "../io/video/ppu";
import { Lcd } from "../io/video/lcd";
import { Timer } from "../io/timer";
import { Dma } from "../io/video/dma";
import { CgbState } from "../cgbState";
import { Cartridge } from "../cartridge";
import { CGBMode } from "../metadata";
import { describe, it, assertEquals } from "./framework";

function setupDmgNopSled(): void {
    Cartridge.Data.cgbFlag = 0x00;
    CgbState.setIsCGB(false);
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Emulator.Init(false);
}

function setupCgbNopSled(): void {
    Cartridge.Data.cgbFlag = CGBMode.CGBOnly as u8;
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, CGBMode.CGBOnly as u8);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Emulator.Init(false);
}

// ─── Bug 1: STOP + speed switch ─────────────────────────────────────────────

function testStopResetsDiv(): void {
    // Pan Docs: "$FF04 DIV: ... Also reset by stop."
    // Hardware: STOP instruction resets the full 16-bit internal DIV counter to 0.
    it("STOP resets internal DIV to 0 (DMG)", () => {
        setupDmgNopSled();
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        // advance DIV to known non-zero value
        Timer.internalDiv = 0xABCD;
        Cpu.ProgramCounter = 0x100;
        Cpu.executeNextInstruction();
        assertEquals<u16>(Timer.internalDiv, 0, "internalDiv == 0 after STOP");
    });
}

function testSpeedSwitchResetsDiv(): void {
    // Spec (CGB): during speed switch pause, DIV is reset (and stops ticking).
    it("CGB speed-switch STOP resets internal DIV to 0", () => {
        setupCgbNopSled();
        CgbState.setKey1(0x01);
        Timer.internalDiv = 0xABCD;
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        Cpu.ProgramCounter = 0x100;
        Cpu.executeNextInstruction();
        assertEquals<u16>(Timer.internalDiv, 0, "internalDiv == 0 after speed switch");
    });
}

function testSpeedSwitchStalls2050MCycles(): void {
    // Spec: "CPU stops for 2050 M-cycles during switch" = 8200 T-cycles.
    it("CGB speed-switch STOP consumes 2050 M-cycles (8200 T-cycles)", () => {
        setupCgbNopSled();
        CgbState.setKey1(0x01);
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        Cpu.ProgramCounter = 0x100;
        Cpu.CycleCount = 0;
        const cyclesBefore = Cpu.CycleCount;
        Cpu.Tick();
        const consumed = Cpu.CycleCount - cyclesBefore;
        // STOP itself = 4 T-cycles + 8200 T-cycle stall = 8204 T-cycles.
        assertEquals<u64>(consumed, 8204, "speed-switch STOP consumes 8204 T-cycles");
    });
}

function testSpeedSwitchDivFrozenDuringStall(): void {
    // Spec: during speed switch stall, DIV does not tick.
    // After DIV reset, internal DIV must remain 0 even as stall consumes cycles.
    it("DIV stays 0 during speed-switch stall (not advanced by stall T-cycles)", () => {
        setupCgbNopSled();
        CgbState.setKey1(0x01);
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        Cpu.ProgramCounter = 0x100;
        Cpu.Tick();
        // DIV must be 0 after the stall completes (reset + frozen during stall).
        assertEquals<u16>(Timer.internalDiv, 0, "internalDiv == 0 after stall");
    });
}

function testSpeedSwitchDoesNotSetIsStopped(): void {
    // Speed switch must NOT put CPU into isStopped state (no joypad wake needed).
    it("CGB speed-switch STOP does not set isStopped (recovery after stall)", () => {
        setupCgbNopSled();
        CgbState.setKey1(0x01);
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        Cpu.ProgramCounter = 0x100;
        Cpu.Tick();
        assert(!Cpu.isStopped, "isStopped must be false after speed switch");
        assertEquals<boolean>(CgbState.doubleSpeed, true, "double-speed active");
    });
}

function testSpeedSwitchClearsArmedBit(): void {
    // KEY1 bit0 (armed) auto-cleared after switch. KEY1 bit7 reflects current speed.
    it("KEY1 bit0 cleared and bit7 set after speed switch", () => {
        setupCgbNopSled();
        CgbState.setKey1(0x01);
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        Cpu.ProgramCounter = 0x100;
        Cpu.Tick();
        assertEquals<u8>(CgbState.key1 & 0x81, 0x80, "key1: bit7=1 (double), bit0=0 (not armed)");
    });
}

// ─── Bug 2: double-speed cycle accounting ───────────────────────────────────

function testDoubleSpeedTimerRate(): void {
    // Pan Docs: in double-speed, Timer/DIV run at 2x wall-clock rate.
    // Timer counter is clocked by CPU T-cycles (CPU doubles → DIV doubles per wall-clock).
    // Passing "masterCycles" (halved in double-speed) to Timer would give SAME rate as normal.
    // Expected: Timer.internalDiv advances by full t_cycles per CPU instruction.
    it("Timer.internalDiv advances by t_cycles (not masterCycles) in double-speed", () => {
        setupCgbNopSled();
        CgbState.setDoubleSpeed(true);
        Timer.internalDiv = 0;
        // Run 10 NOPs = 40 T-cycles. Timer must reflect 40 T-cycle advance.
        for (let i = 0; i < 10; i++) Emulator.Tick();
        assertEquals<u16>(Timer.internalDiv, 40, "internalDiv advances 40 in double-speed");
    });
}

function testDoubleSpeedOamDmaRate(): void {
    // Pan Docs: in double-speed, OAM DMA runs 2x wall-clock faster but takes same
    // number of CPU M-cycles (160) → half the wall-clock time, same CPU instruction count.
    // OAM DMA clocked by CPU T-cycles (not master cycles).
    // 160 NOPs (640 T-cycles) must complete OAM DMA regardless of speed.
    it("OAM DMA completes after 160 NOPs in double-speed (1 byte per 4 T-cycles)", () => {
        setupCgbNopSled();
        CgbState.setDoubleSpeed(true);
        // Start DMA from WRAM ($C000). Value=$C0 triggers DMA.
        MemoryMap.GBstore<u8>(0xFF46, 0xC0);
        assert(Dma.active, "DMA active after start");
        // 160 NOPs = 160 CPU M-cycles = 160 bytes transferred.
        // Include 2 startDelay: need 162 NOPs to complete.
        for (let i = 0; i < 162; i++) Emulator.Tick();
        assert(!Dma.active, "DMA complete after 162 NOPs in double-speed");
    });
}

function testNormalSpeedTimerRate(): void {
    // Sanity: at normal speed, Timer advances by t_cycles (=masterCycles) as always.
    it("Timer.internalDiv advances by t_cycles in normal speed (regression check)", () => {
        setupCgbNopSled();
        assertEquals<boolean>(CgbState.doubleSpeed, false, "normal speed");
        Timer.internalDiv = 0;
        for (let i = 0; i < 10; i++) Emulator.Tick();
        assertEquals<u16>(Timer.internalDiv, 40, "internalDiv advances 40 in normal speed");
    });
}

function testNormalSpeedOamDmaRate(): void {
    it("OAM DMA completes after 162 NOPs in normal speed (regression check)", () => {
        setupCgbNopSled();
        assertEquals<boolean>(CgbState.doubleSpeed, false, "normal speed");
        MemoryMap.GBstore<u8>(0xFF46, 0xC0);
        assert(Dma.active, "DMA active after start");
        for (let i = 0; i < 162; i++) Emulator.Tick();
        assert(!Dma.active, "DMA complete after 162 NOPs in normal speed");
    });
}

// ─── Bug 3: VBlank/STAT interrupt in CGB path ───────────────────────────────

function testCgbVBlankInterruptFires(): void {
    // VBlank interrupt must fire in CGB mode identically to DMG.
    it("VBlank IF bit set after one frame in CGB mode", () => {
        setupCgbNopSled();
        MemoryMap.GBstore<u8>(0xFFFF, 0x01);
        Interrupt.masterEnabled = false;
        Emulator.RunFrames(1);
        const ifReg = MemoryMap.GBload<u8>(0xFF0F);
        assert((ifReg & <u8>IntType.VBlank) != 0, "VBlank IF bit set in CGB");
    });
}

function testCgbStatInterruptFires(): void {
    // STAT interrupt on mode 2 (OAM scan) must fire in CGB mode.
    // STAT bit 5 enables mode 2 interrupt. At scanline 1 we enter OAM scan → STAT fires.
    it("STAT IF bit set when mode 2 STAT enabled in CGB mode", () => {
        setupCgbNopSled();
        // Enable STAT mode 2 interrupt.
        MemoryMap.GBstore<u8>(0xFF41, 0x20);
        // clear IF
        MemoryMap.GBstore<u8>(0xFF0F, 0x00);
        Interrupt.masterEnabled = false;
        // Run enough to finish scanline 0 and enter mode 2 of scanline 1.
        // 114 NOPs = 456 T-cycles = one scanline, lands at OAMScan start of next line.
        for (let i = 0; i < 115; i++) Emulator.Tick();
        const ifReg = MemoryMap.GBload<u8>(0xFF0F);
        assert((ifReg & <u8>IntType.LcdSTAT) != 0, "STAT IF bit set on mode 2 in CGB");
    });
}

function testCgbLycStatInterruptFires(): void {
    // LYC=LY STAT interrupt must fire in CGB mode.
    it("LYC=LY STAT IF bit set in CGB mode", () => {
        setupCgbNopSled();
        // Enable LYC=LY STAT interrupt (bit 6), LYC = 5.
        MemoryMap.GBstore<u8>(0xFF41, 0x40);
        MemoryMap.GBstore<u8>(0xFF45, 0x05);
        MemoryMap.GBstore<u8>(0xFF0F, 0x00);
        Interrupt.masterEnabled = false;
        // 5 scanlines × 114 NOPs = 570 NOPs to reach LY=5.
        for (let i = 0; i < 570; i++) Emulator.Tick();
        const ifReg = MemoryMap.GBload<u8>(0xFF0F);
        assert((ifReg & <u8>IntType.LcdSTAT) != 0, "STAT IF bit set on LYC=LY in CGB");
    });
}

// ─── Suite Entry Point ──────────────────────────────────────────────────────

export function testCgbSpeedSwitch(): boolean {
    describe("CGB - STOP + speed switch", () => {
        testStopResetsDiv();
        testSpeedSwitchResetsDiv();
        testSpeedSwitchStalls2050MCycles();
        testSpeedSwitchDivFrozenDuringStall();
        testSpeedSwitchDoesNotSetIsStopped();
        testSpeedSwitchClearsArmedBit();
    });

    describe("CGB - Double-speed cycle accounting", () => {
        testNormalSpeedTimerRate();
        testNormalSpeedOamDmaRate();
        testDoubleSpeedTimerRate();
        testDoubleSpeedOamDmaRate();
    });

    describe("CGB - VBlank/STAT interrupts", () => {
        testCgbVBlankInterruptFires();
        testCgbStatInterruptFires();
        testCgbLycStatInterruptFires();
    });

    Cartridge.Data.cgbFlag = 0x00;
    CgbState.setIsCGB(false);
    CgbState.setDoubleSpeed(false);
    CgbState.setKey1(0);

    return true;
}
