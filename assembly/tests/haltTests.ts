import { Cpu } from "../cpu/cpu";
import { IntType, Interrupt } from "../cpu/interrupts";
import { CARTRIDGE_ROM_START, GB_IO_START } from "../memory/memoryConstants";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";
import { Joypad } from "../io/joypad";
import { describe, it } from "./framework";

function setupRomProgram(instructions: Array<u8>): void {
    memory.fill(CARTRIDGE_ROM_START, 0, 0x100);
    memory.copy(CARTRIDGE_ROM_START + 0x100, instructions.dataStart, instructions.length);
    MemoryMap.loadedCartridgeRomSize = instructions.length;
    Emulator.Init(false);
}

function setIntProgram(int: IntType, instructions: Array<u8>): void {
    const intGbAddress: u16 = Interrupt.GetHandlerAddress(int);
    memory.copy(CARTRIDGE_ROM_START + intGbAddress, instructions.dataStart, instructions.length);
}

function setIeIf(ie: u8, iflag: u8): void {
    store<u8>(GB_IO_START + 0xFF, ie);
    store<u8>(GB_IO_START + 0x0F, iflag);
}

// ---------------------------------------------------------------------------
// HALT with IME=0, no pending interrupt: stays halted
// Spec: "IME=0, no pending interrupt: HALT executes normally. Wakes when interrupt
//        becomes pending. Interrupt NOT handled (IME=0)."
// ---------------------------------------------------------------------------

function testHaltIME0NoPendingStaysHalted(): void {
    setupRomProgram([
        0x76,  // HALT at 0x100
        0x04,  // INC B at 0x101
    ]);
    Interrupt.masterEnabled = false;
    setIeIf(0x04, 0x00); // IE=timer, IF=0 (nothing pending)
    Cpu.SetB(0);

    Cpu.Tick(); // execute HALT
    assert(Cpu.isHalted, "IME=0 no pending: HALT should set isHalted");
    assert(!Cpu.haltBug, "no halt bug when IF is clear");

    for (let i = 0; i < 5; i++) Cpu.Tick();
    assert(Cpu.isHalted, "stays halted with no pending interrupt");
    assert(Cpu.B() == 0, "INC B not executed while halted");
}

// ---------------------------------------------------------------------------
// HALT with IME=0 wakes when interrupt becomes pending, does NOT service it
// ---------------------------------------------------------------------------

function testHaltIME0WakesWithoutServicing(): void {
    setupRomProgram([
        0x76,  // HALT at 0x100
        0x04,  // INC B at 0x101
        0x00,  // NOP at 0x102
    ]);
    Interrupt.masterEnabled = false;
    setIeIf(0x04, 0x00); // IE=timer, IF=0
    Cpu.SetB(0);

    Cpu.Tick(); // HALT → isHalted=true
    assert(Cpu.isHalted, "halted");

    // make interrupt pending
    setIeIf(0x04, 0x04);
    Cpu.Tick(); // halted tick: (Requests & Enabled) != 0 → isHalted=false
    assert(!Cpu.isHalted, "woke up when interrupt became pending");
    assert(!Interrupt.masterEnabled, "IME still false (interrupt not serviced)");
    assert((Interrupt.Requests() & 0x04) != 0, "IF timer bit still set (not cleared by dispatch)");

    Cpu.Tick(); // executes INC B at 0x101
    assert(Cpu.B() == 1, "INC B executed after wakeup");
    assert(Cpu.ProgramCounter == 0x0102, "PC advanced past INC B");
}

// ---------------------------------------------------------------------------
// HALT BUG: IME=0 + pending interrupt → exits immediately, haltBug flag set
// Spec: "HALT exits immediately. PC fails to increment normally."
// ---------------------------------------------------------------------------

function testHaltBugTriggers(): void {
    setupRomProgram([
        0x76,  // HALT at 0x100
        0x00,  // NOP at 0x101
    ]);
    Interrupt.masterEnabled = false;
    setIeIf(0x04, 0x04); // Timer IE + IF pending

    Cpu.Tick(); // execute HALT
    assert(!Cpu.isHalted, "halt bug: CPU not halted (exits immediately)");
    assert(Cpu.haltBug, "halt bug: haltBug flag set");
    assert(Cpu.ProgramCounter == 0x0101, "PC advanced to byte after HALT");
}

// ---------------------------------------------------------------------------
// HALT BUG: next instruction's PC does not advance
// Spec: "byte after HALT read twice (PC stuck for one fetch)"
// ---------------------------------------------------------------------------

function testHaltBugPCDoesNotAdvance(): void {
    setupRomProgram([
        0x76,  // HALT at 0x100
        0x04,  // INC B at 0x101
        0x00,  // NOP at 0x102
    ]);
    Interrupt.masterEnabled = false;
    setIeIf(0x04, 0x04);
    Cpu.SetB(0);

    Cpu.Tick(); // HALT → haltBug=true, PC=0x101
    assert(Cpu.haltBug, "haltBug set after HALT");

    Cpu.Tick(); // INC B at 0x101 with haltBug: nextPc = 0x101 (no advance)
    assert(Cpu.B() == 1, "INC B executed");
    assert(!Cpu.haltBug, "haltBug cleared after consuming");
    assert(Cpu.ProgramCounter == 0x0101, "PC stays at 0x101 (halt bug: no advance)");

    Cpu.Tick(); // INC B again from 0x101 (haltBug cleared, advances normally)
    assert(Cpu.B() == 2, "INC B executed again (re-executed from 0x101)");
    assert(Cpu.ProgramCounter == 0x0102, "PC now advances normally to 0x102");
}

// ---------------------------------------------------------------------------
// HALT BUG + RST: return address points to RST itself, not byte after
// Spec: "HALT followed immediately by RST: RST return addr points to RST itself.
//        ret inside handler re-executes RST."
// ---------------------------------------------------------------------------

function testHaltBugRSTReturnAddr(): void {
    setupRomProgram([
        0x76,  // HALT at 0x100
        0xFF,  // RST $38 at 0x101 (1-byte, pushes nextPc then jumps to 0x0038)
        0x00,  // NOP at 0x102 (should never reach here via return)
    ]);
    store<u8>(CARTRIDGE_ROM_START + 0x0038, 0xC9); // RET at RST $38 vector (direct write, GBstore routes ROM through MBC)

    Interrupt.masterEnabled = false;
    setIeIf(0x04, 0x04);

    Cpu.Tick(); // HALT → haltBug=true, PC=0x101
    assert(Cpu.haltBug, "haltBug set");

    Cpu.Tick(); // RST $38 with haltBug: nextPc=0x101, pushes 0x0101, jumps to 0x0038
    assert(Cpu.ProgramCounter == 0x0038, "PC at RST $38 vector (0x0038)");

    Cpu.Tick(); // RET → pops 0x0101 from stack
    assert(Cpu.ProgramCounter == 0x0101,
        `RET should return to RST address (0x101), got 0x${Cpu.ProgramCounter.toString(16)}`);
}

// ---------------------------------------------------------------------------
// HALT with IME=1 + pending interrupt: normal wakeup, ISR dispatched
// Spec: "IME=1: CPU wakes, interrupt handler called normally before next instr."
// ---------------------------------------------------------------------------

function testHaltIME1NormalWakeup(): void {
    setupRomProgram([0x76]); // HALT at 0x100
    setIntProgram(IntType.Timer, [0x3C, 0xD9]); // INC A, RETI at 0x50
    Interrupt.masterEnabled = true;
    setIeIf(0x04, 0x04);
    Cpu.SetA(0);

    // IME=1 + pending: HALT sets isHalted then HandleInterrupts immediately fires (same tick)
    Cpu.Tick(); // HALT + ISR dispatch in one tick
    assert(!Cpu.haltBug, "no halt bug with IME=1");
    assert(!Cpu.isHalted, "isHalted cleared by ISR dispatch");
    assert(Cpu.ProgramCounter == 0x0050, "ISR dispatched to timer vector 0x50 in same tick as HALT");
    assert(!Interrupt.masterEnabled, "IME cleared by ISR dispatch");

    // run INC A, RETI
    Cpu.Tick(); // INC A
    Cpu.Tick(); // RETI
    assert(Cpu.A() == 1, "ISR handler ran (INC A)");
    assert(Interrupt.masterEnabled, "RETI re-enables IME");
    assert(Cpu.ProgramCounter == 0x0101,
        `returned to 0x101 (after HALT), got 0x${Cpu.ProgramCounter.toString(16)}`);
}

// ---------------------------------------------------------------------------
// STOP wakes when joypad interrupt fires
// Spec: "Main use [of joypad interrupt]: wake from STOP mode."
// ---------------------------------------------------------------------------

function testStopWakesOnJoypad(): void {
    setupRomProgram([
        0x10, 0x00, // STOP at 0x100
        0x04,       // INC B at 0x102
    ]);
    Interrupt.masterEnabled = false;
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>IntType.Joypad);
    MemoryMap.GBstore<u8>(0xFFFF, <u8>IntType.Joypad); // IE: joypad bit
    Cpu.SetB(0);

    Cpu.Tick(); // STOP → isStopped=true
    assert(Cpu.isStopped, "isStopped=true after STOP");

    // No joypad interrupt yet → stays stopped
    for (let i = 0; i < 3; i++) Cpu.Tick();
    assert(Cpu.isStopped, "stays stopped with no joypad interrupt");

    // Press button → joypad IF fires → CPU wakes
    Joypad.SetKeys(0x01);
    assert(Interrupt.HasRequest(IntType.Joypad), "joypad IF set after key press");

    Cpu.Tick(); // stopped tick with joypad IF → isStopped=false
    assert(!Cpu.isStopped, "STOP wakes when joypad IF fires");
}

export function testHalt(): boolean {
    describe("HALT", () => {
        it("IME=0 no pending: stays halted", () => { testHaltIME0NoPendingStaysHalted(); });
        it("IME=0 wakes on pending interrupt but does not service it", () => { testHaltIME0WakesWithoutServicing(); });
        it("halt bug triggers when IME=0 and interrupt pending", () => { testHaltBugTriggers(); });
        it("halt bug: next instruction PC does not advance", () => { testHaltBugPCDoesNotAdvance(); });
        it("halt bug + RST: return address is RST address itself", () => { testHaltBugRSTReturnAddr(); });
        it("IME=1: HALT wakes normally and ISR dispatches", () => { testHaltIME1NormalWakeup(); });
    });
    describe("STOP", () => {
        it("STOP wakes when joypad IF fires (spec: main wake mechanism)", () => { testStopWakesOnJoypad(); });
    });
    return true;
}
