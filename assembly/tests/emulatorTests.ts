import { Cpu } from "../cpu/cpu";
import { Interrupt, IntType } from "../cpu/interrupts";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";
import { Ppu, PpuMode } from "../io/video/ppu";
import { Lcd } from "../io/video/lcd";
import { Debugger } from "../debug/debugger";
import { describe, it, assertEquals } from "./framework";

// EmulatorStopReason values (not exported from emulator.ts):
const STOP_HIT_BREAKPOINT: i32 = 1;
const STOP_CPU_STOP: i32 = 3;
const STOP_END_OF_FRAME: i32 = 4;

// Pan Docs: 154 lines × 456 dots = 70,224 dots/frame.
// VBlank starts at LY=144 → after 144 × 456 = 65,664 T-cycles.
// OAMScan=80 dots, min Transfer=172 dots, HBlank=204 dots (per scanline=456).

function setupNopSled(): void {
    // Fill cartridge ROM with NOPs (0x00); execution starts at 0x100.
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Emulator.Init(false);
}

// ─── Full Frame + PPU Mode Tracking ──────────────────────────────────────────

function testFrameEndOfFrame(): void {
    it("RunFrames(1) returns EndOfFrame", () => {
        setupNopSled();
        const reason = Emulator.RunFrames(1);
        assertEquals<i32>(reason as i32, STOP_END_OF_FRAME, "stop reason");
    });
}

function testVBlankAtLine144(): void {
    it("VBlank starts at LY=144 (Pan Docs: 144 active lines)", () => {
        setupNopSled();
        Emulator.RunFrames(1);
        assertEquals<u8>(Lcd.data.lY, 144, "LY on VBlank entry");
        assertEquals<i32>(Ppu.currentMode as i32, PpuMode.VBlank as i32, "PPU mode on VBlank entry");
    });
}

function testFrameCounterIncrement(): void {
    it("frame counter increments each VBlank", () => {
        setupNopSled();
        assertEquals<u32>(Ppu.currentFrame, 0, "frame=0 before run");
        Emulator.RunFrames(1);
        assertEquals<u32>(Ppu.currentFrame, 1, "frame=1 after 1 frame");
        Emulator.RunFrames(1);
        assertEquals<u32>(Ppu.currentFrame, 2, "frame=2 after 2 frames");
    });
}

function testVBlankCycleCount(): void {
    // Pan Docs: VBlank fires after 144 × 456 = 65,664 T-cycles from frame start.
    // With NOP sled (4 T-cycles each), CycleCount should be exactly 65,664.
    it("VBlank fires after exactly 65,664 T-cycles (144 × 456 dots)", () => {
        setupNopSled();
        Emulator.RunFrames(1);
        assertEquals<u64>(Cpu.CycleCount, 65664, "T-cycles to first VBlank");
    });
}

function testPpuModeCycleOAMtoTransfer(): void {
    // OAMScan lasts 80 dots. With NOPs (4 T/NOP), 20 ticks = 80 dots → Transfer.
    it("PPU enters Transfer after 80 OAMScan dots", () => {
        setupNopSled();
        assertEquals<i32>(Ppu.currentMode as i32, PpuMode.OAMScan as i32, "starts in OAMScan");
        for (let i = 0; i < 20; i++) Emulator.Tick();
        assertEquals<i32>(Ppu.currentMode as i32, PpuMode.Transfer as i32, "after 80 dots: Transfer");
    });
}

function testPpuModeCycleTransferToHBlank(): void {
    // OAMScan (80) + min Transfer (172) = 252 dots = 63 NOPs total → HBlank.
    it("PPU enters HBlank after OAMScan + Transfer (252 dots min)", () => {
        setupNopSled();
        // 20 NOPs → end of OAMScan, enter Transfer
        for (let i = 0; i < 20; i++) Emulator.Tick();
        // 43 more NOPs = 172 dots (minimum Transfer duration)
        for (let i = 0; i < 43; i++) Emulator.Tick();
        assertEquals<i32>(Ppu.currentMode as i32, PpuMode.HBlank as i32, "after 252 dots: HBlank");
    });
}

function testPpuModeScanlineComplete(): void {
    // Full scanline = 456 dots = 114 NOPs → back to OAMScan, LY incremented.
    it("PPU returns to OAMScan after 456 dots (1 scanline)", () => {
        setupNopSled();
        for (let i = 0; i < 114; i++) Emulator.Tick();
        assertEquals<i32>(Ppu.currentMode as i32, PpuMode.OAMScan as i32, "after 456 dots: OAMScan");
        assertEquals<u8>(Lcd.data.lY, 1, "LY=1 after scanline 0");
    });
}

function testVBlankInterruptFires(): void {
    it("VBlank interrupt (IF bit 0) set when entering VBlank", () => {
        setupNopSled();
        // Enable VBlank interrupt in IE ($FFFF bit 0) but keep IME off.
        MemoryMap.GBstore<u8>(0xFFFF, 0x01);
        Interrupt.masterEnabled = false;
        Emulator.RunFrames(1);
        // IF bit 0 should be set (VBlank requested).
        const ifReg = MemoryMap.GBload<u8>(0xFF0F);
        assert((ifReg & 0x01) != 0, "VBlank IF bit should be set");
    });
}

// ─── STOP Instruction ────────────────────────────────────────────────────────

function testStopSetsFlag(): void {
    // Pan Docs: STOP (0x10 0x00) halts until button pressed. CPU enters stopped state.
    it("STOP instruction sets isStopped flag", () => {
        memory.fill(CARTRIDGE_ROM_START, 0x00, 0x100);
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        MemoryMap.loadedCartridgeRomSize = 0x102;
        Emulator.Init(false);
        assert(!Cpu.isStopped, "isStopped=false before STOP");
        Cpu.Tick();
        assert(Cpu.isStopped, "isStopped=true after STOP");
    });
}

function testStopCausesRunStop(): void {
    it("RunFrames returns CpuStop (3) when STOP executed", () => {
        // One NOP then STOP: PC=0x100 NOP, PC=0x101 STOP.
        const prog = <Array<u8>>[0x00, 0x10, 0x00];
        memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
        memory.copy(CARTRIDGE_ROM_START + 0x100, prog.dataStart, prog.length);
        MemoryMap.loadedCartridgeRomSize = 0x8000;
        Emulator.Init(false);
        const reason = Emulator.RunFrames(1);
        assertEquals<i32>(reason as i32, STOP_CPU_STOP, "stop reason = CpuStop");
        assert(Cpu.isStopped, "CPU is stopped");
    });
}

// ─── Emulator Reset Between Game Loads ───────────────────────────────────────

function testResetClearsState(): void {
    it("Emulator.Init resets CPU state (PC, CycleCount, isStopped)", () => {
        setupNopSled();
        Emulator.RunFrames(1);
        assert(Cpu.CycleCount > 0, "CycleCount > 0 after running");
        assert(Ppu.currentFrame > 0, "frame > 0 after running");

        // Simulate new game load: re-init.
        Emulator.Init(false);
        assertEquals<u64>(Cpu.CycleCount, 0, "CycleCount=0 after reset");
        assertEquals<u16>(Cpu.ProgramCounter, 0x100, "PC=0x100 after reset");
        assertEquals<u32>(Ppu.currentFrame, 0, "frame=0 after reset");
        assert(!Cpu.isStopped, "isStopped=false after reset");
        assert(!Cpu.isHalted, "isHalted=false after reset");
    });
}

function testResetAfterStop(): void {
    it("Emulator.Init clears STOP state", () => {
        memory.fill(CARTRIDGE_ROM_START, 0x00, 0x100);
        memory.copy(CARTRIDGE_ROM_START + 0x100, (<Array<u8>>[0x10, 0x00]).dataStart, 2);
        MemoryMap.loadedCartridgeRomSize = 0x102;
        Emulator.Init(false);
        Emulator.RunFrames(1);
        assert(Cpu.isStopped, "stopped after STOP instruction");

        // Re-init = new game loaded.
        Emulator.Init(false);
        assert(!Cpu.isStopped, "isStopped cleared by reset");
        assertEquals<u64>(Cpu.CycleCount, 0, "CycleCount=0 after reset");
    });
}

// ─── Debugger: Breakpoints & Stepping ────────────────────────────────────────

function testBreakpointHits(): void {
    it("RunFrames stops at breakpoint address", () => {
        setupNopSled();
        Debugger.attached = true;
        Debugger.SetBreakpoint(0x0105, true); // break BEFORE 6th instruction

        const reason = Emulator.RunFrames(1);
        assertEquals<i32>(reason as i32, STOP_HIT_BREAKPOINT, "stop reason = HitBreakpoint");
        assertEquals<u16>(Cpu.ProgramCounter, 0x0105, "PC at breakpoint");

        Debugger.SetBreakpoint(0x0105, false);
        Debugger.attached = false;
    });
}

function testBreakpointNotHitWhenDetached(): void {
    it("breakpoint ignored when debugger not attached", () => {
        setupNopSled();
        Debugger.attached = false;
        Debugger.SetBreakpoint(0x0105, true);

        const reason = Emulator.RunFrames(1);
        assertEquals<i32>(reason as i32, STOP_END_OF_FRAME, "stop reason = EndOfFrame (not breakpoint)");

        Debugger.SetBreakpoint(0x0105, false);
    });
}

function testBreakpointRemoval(): void {
    it("removed breakpoint does not stop execution", () => {
        setupNopSled();
        Debugger.attached = true;
        Debugger.SetBreakpoint(0x0105, true);
        Debugger.SetBreakpoint(0x0105, false); // remove it

        const reason = Emulator.RunFrames(1);
        assertEquals<i32>(reason as i32, STOP_END_OF_FRAME, "stop reason = EndOfFrame after removal");

        Debugger.attached = false;
    });
}

function testInstructionStepping(): void {
    // BP check fires AFTER Emulator.Tick() when Cpu.ProgramCounter == BP address.
    // After first NOP@0x100, PC=0x101 → BP at 0x0101 fires immediately.
    it("Debugger.Step advances PC by one instruction", () => {
        setupNopSled();
        Debugger.attached = true;
        Debugger.SetBreakpoint(0x0101, true);
        Emulator.RunFrames(1);

        assertEquals<u16>(Cpu.ProgramCounter, 0x0101, "PC at breakpoint");

        Debugger.Step();
        assertEquals<u16>(Cpu.ProgramCounter, 0x0102, "PC after one step");

        Debugger.Step();
        assertEquals<u16>(Cpu.ProgramCounter, 0x0103, "PC after two steps");

        Debugger.SetBreakpoint(0x0101, false);
        Debugger.attached = false;
    });
}

function testMultipleBreakpoints(): void {
    it("multiple breakpoints: fires at nearest one", () => {
        setupNopSled();
        Debugger.attached = true;
        Debugger.SetBreakpoint(0x0102, true);
        Debugger.SetBreakpoint(0x0108, true);

        const reason = Emulator.RunFrames(1);
        assertEquals<i32>(reason as i32, STOP_HIT_BREAKPOINT, "hit breakpoint");
        assertEquals<u16>(Cpu.ProgramCounter, 0x0102, "stops at nearest breakpoint");

        Debugger.SetBreakpoint(0x0102, false);
        Debugger.SetBreakpoint(0x0108, false);
        Debugger.attached = false;
    });
}

// ─── Suite Entry Point ────────────────────────────────────────────────────────

export function testEmulator(): boolean {
    describe("Emulator - Full Frame + PPU Modes", () => {
        testFrameEndOfFrame();
        testVBlankAtLine144();
        testFrameCounterIncrement();
        testVBlankCycleCount();
        testPpuModeCycleOAMtoTransfer();
        testPpuModeCycleTransferToHBlank();
        testPpuModeScanlineComplete();
        testVBlankInterruptFires();
    });

    describe("Emulator - STOP Instruction", () => {
        testStopSetsFlag();
        testStopCausesRunStop();
    });

    describe("Emulator - Reset Between Loads", () => {
        testResetClearsState();
        testResetAfterStop();
    });

    describe("Debugger - Breakpoints & Stepping", () => {
        testBreakpointHits();
        testBreakpointNotHitWhenDetached();
        testBreakpointRemoval();
        testInstructionStepping();
        testMultipleBreakpoints();
    });

    return true;
}
