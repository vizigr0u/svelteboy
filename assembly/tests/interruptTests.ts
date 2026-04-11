import { Cpu } from "../cpu/cpu";
import { IntType, Interrupt } from "../cpu/interrupts";
import { CARTRIDGE_ROM_START,GB_IO_START  } from "../memory/memoryConstants";
import { SP, setTestRom } from "./cpuTests";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";
import { Timer } from "../io/timer";

function setIntProgram(int: IntType, instructions: Array<u8>): void {
    const intGbAddress: u16 = Interrupt.GetHandlerAddress(int);
    memory.copy(CARTRIDGE_ROM_START + intGbAddress, instructions.dataStart, instructions.length);
}

function setupRomProgram(instructions: Array<u8>): void {
    memory.fill(CARTRIDGE_ROM_START, 0, 0x100);
    memory.copy(CARTRIDGE_ROM_START + 0x100, instructions.dataStart, instructions.length);
    MemoryMap.loadedCartridgeRomSize = instructions.length;
    Emulator.Init(false);
}

function testInt1(): void {
    // first bits of DMG boot rom: setup SP and clear VRAM (0x8000->0x9FFF)
    setupRomProgram([
        0x3E, 0x04,         // LD A, $04
        0xE0, 0xFF,         // LDH [$FF], A  => IE = 04 (Timer int)
        0xFB,               // EI
        0x01, 0x00, 0x00,   // LD BC 0
        0xC5,               // PUSH BC
        0xC1,               // POP BC
        0x04,               // INC B
        0x3E, 0x04,         // LD A, $04
        0xE0, 0x0F,         // LDH [$0F], A  => IF = 04 (Timer int)
        0x00]);
    setIntProgram(IntType.Timer, [
        0x3C, // inc A
        0xC9  // ret
    ]);
    for (let i = 0; Cpu.ProgramCounter != 0x0010; i++) {
        Cpu.Tick();
    }
    assert(Cpu.A() == 50, `Expected A=50, got A=${Cpu.A()}`);
}

// ISR dispatch must cost exactly 5 M-cycles (20 T-cycles):
//   2 wait states + 2 push PC + 1 set PC to handler
// This is observable via CycleCount since Timer.Tick and PPU.Tick use it.
//
// Program layout (at 0x100):
//   LD A,$04 / LDH [IE],A   -- enable timer interrupt in IE
//   LD A,$04 / LDH [IF],A   -- set IF while IME=0 (no dispatch yet)
//   EI                       -- isEnablingIME=true (delay by 1 instr)
//   NOP                      -- IME becomes active at end of this tick, no check yet
//   NOP                      -- THIS tick: execute NOP (4 T), then ISR fires (+20 T) = 24 T total
//   HALT                     -- end
//
// By setting IF before EI, the interrupt is pending when IME finally enables.
// The ISR fires on the first NOP after IME is active, so we measure exactly
// NOP (4 T-cycles) + ISR dispatch (20 T-cycles) = 24 T-cycles for that tick.
function testIsrDispatchCycles(): void {
    setupRomProgram([
        0x3E, 0x04,   // LD A, $04
        0xE0, 0xFF,   // LDH [$FF], A    -- IE = timer bit
        0x3E, 0x04,   // LD A, $04
        0xE0, 0x0F,   // LDH [$0F], A    -- IF = timer bit (IME still off)
        0xFB,         // EI               -- isEnablingIME = true
        0x00,         // NOP              -- IME becomes active at end of this tick
        0x00,         // NOP              -- ISR fires here: 4 + 20 = 24 T-cycles
        0x76,         // HALT             -- end marker
    ]);
    setIntProgram(IntType.Timer, [
        0xC9  // RET
    ]);

    let cyclesBeforeIsr: u64 = 0;
    let cyclesAfterIsr: u64 = 0;
    let isrFired = false;
    for (let i = 0; i < 1000; i++) {
        const prevIME = Interrupt.masterEnabled;
        if (!isrFired) {
            cyclesBeforeIsr = Cpu.CycleCount;
        }
        Cpu.Tick();
        if (prevIME && !isrFired && Cpu.ProgramCounter == 0x0050) {
            isrFired = true;
            cyclesAfterIsr = Cpu.CycleCount;
        }
        if (Cpu.isHalted) break;
    }

    assert(isrFired, 'ISR never fired');
    // NOP (4 T-cycles) + ISR dispatch (2 wait + 2 push + 1 set PC = 5 M = 20 T) = 24 T
    const dispatchCycles = cyclesAfterIsr - cyclesBeforeIsr;
    assert(dispatchCycles == 24,
        `ISR dispatch: expected 24 T-cycles (4 NOP + 20 ISR), got ${dispatchCycles}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
 
/** Write a single byte into GB address space (for placing handler code / IO). */
function gbStore(gbAddr: u16, value: u8): void {
    MemoryMap.GBstore<u8>(gbAddr, value);
}
 
/** Convenience: set IE and IF registers. */
function setIeIf(ie: u8, iflag: u8): void {
    store<u8>(GB_IO_START + 0xFF, ie);   // IE @ $FFFF
    store<u8>(GB_IO_START + 0x0F, iflag); // IF @ $FF0F
}
 
// ---------------------------------------------------------------------------
// Bug 1 – "ei then di" must leave IME disabled
// ---------------------------------------------------------------------------
//   Spec: "ei followed immediately by di does not allow any interrupts
//          between them."
//   Bug:  DI clears masterEnabled but not isEnablingIME, so at the end
//         of the DI tick the deferred path re-enables masterEnabled.
 
function testEiDiCancelsIME(): void {
    //  0000: ei          ; sets isEnablingIME
    //  0001: di          ; must cancel the pending enable
    //  0002: nop         ; interrupt must NOT fire here
    //  0003: nop         ; expected landing PC
    setTestRom([0xFB, 0xF3, 0x00, 0x00]);
 
    // Enable & request Timer interrupt so it's pending
    setIeIf(0x04, 0x04);
 
    Cpu.Tick(); // execute ei
    Cpu.Tick(); // execute di
    Cpu.Tick(); // execute nop – should be a plain nop, no ISR
 
    assert(
        Cpu.ProgramCounter == 0x0003,
        `ei+di: PC = 0x${Cpu.ProgramCounter.toString(16)}, expected 0x0003 (interrupt must not fire)`
    );
    assert(
        !Interrupt.masterEnabled,
        "ei+di: IME must be disabled after ei immediately followed by di"
    );
}
 
// ---------------------------------------------------------------------------
// Positive counterpart – ei *does* enable IME after one instruction
// ---------------------------------------------------------------------------
//   Confirms the delayed-enable path works when di does NOT follow ei.
 
function testEiEnablesAfterOneInstruction(): void {
    //  0000: ei
    //  0001: nop         ; IME becomes true at end of this tick
    //  0002: nop         ; interrupt should fire before/during this tick
    //  0003: nop         ; (shouldn't reach – ISR redirects PC)
    setTestRom([0xFB, 0x00, 0x00, 0x00]);
 
    // Place a RET ($C9) at the VBlank vector so the ISR returns cleanly
    gbStore(0x0040, 0xC9);
 
    // Enable & request VBlank
    setIeIf(0x01, 0x01);
 
    Cpu.Tick(); // ei  → isEnablingIME; end-of-tick sets masterEnabled
    assert(
        !Interrupt.masterEnabled || Cpu.ProgramCounter == 0x0001,
        "ei: IME should not be active until end of this tick"
    );
 
    Cpu.Tick(); // nop (4 T) + ISR dispatch (20 T) → PC jumps to $0040
 
    assert(
        Cpu.ProgramCounter == 0x0040,
        `ei+nop: PC = 0x${Cpu.ProgramCounter.toString(16)}, expected 0x0040 (VBlank vector)`
    );
}
 
// ---------------------------------------------------------------------------
// Bug 3 – ISR dispatch must cost exactly 20 T-cycles (5 M-cycles)
// ---------------------------------------------------------------------------
//   The test ROM expects 13 cycles for the full sequence:
//      5 (dispatch) + 4 (JP at vector) + 4 (RET) = 13 M-cycles
//   Here we verify just the dispatch portion: Cpu.Tick() should return
//   4 (nop) + 20 (ISR) = 24 T-cycles for the tick that services the int.
 
function testISRDispatchTakes20TCycles(): void {
    //  0000: ei
    //  0001: nop         ; ISR fires on this tick
    setTestRom([0xFB, 0x00, 0x00]);
 
    // Place RET at VBlank vector
    gbStore(0x0040, 0xC9);
 
    setIeIf(0x01, 0x01); // VBlank enabled & requested
 
    Cpu.Tick(); // ei
 
    const cyclesBefore: u64 = Cpu.CycleCount;
    const tickCycles: u8 = Cpu.Tick(); // nop + ISR dispatch
 
    assert(
        tickCycles == 24,
        `ISR tick: ${tickCycles} T-cycles, expected 24 (4 nop + 20 dispatch)`
    );
    assert(
        Cpu.CycleCount - cyclesBefore == 24,
        `CycleCount delta: ${(Cpu.CycleCount - cyclesBefore).toString()}, expected 24`
    );
}
 
// ---------------------------------------------------------------------------
// ISR clears the correct IF bit and disables IME
// ---------------------------------------------------------------------------
 
function testISRClearsIFBitAndIME(): void {
    //  0000: ei
    //  0001: nop
    setTestRom([0xFB, 0x00, 0x00]);
 
    // Place RET at Timer vector ($50)
    gbStore(0x0050, 0xC9);
 
    // Request both VBlank and Timer; only enable Timer in IE
    // Only Timer should be serviced (VBlank not in IE)
    setIeIf(0x04, 0x05); // IE = Timer, IF = VBlank | Timer
 
    Cpu.Tick(); // ei
    Cpu.Tick(); // nop + ISR → should service Timer
 
    assert(
        Cpu.ProgramCounter == 0x0050,
        `ISR target: PC = 0x${Cpu.ProgramCounter.toString(16)}, expected 0x0050 (Timer vector)`
    );
    assert(
        !Interrupt.masterEnabled,
        "ISR must clear IME"
    );
 
    // Timer bit (0x04) should be cleared, VBlank bit (0x01) should remain
    const ifAfter: u8 = Interrupt.Requests();
    assert(
        (ifAfter & 0x04) == 0,
        `IF Timer bit should be cleared after ISR, IF = 0x${ifAfter.toString(16)}`
    );
    assert(
        (ifAfter & 0x01) != 0,
        `IF VBlank bit should still be set (not enabled in IE), IF = 0x${ifAfter.toString(16)}`
    );
}

// ---------------------------------------------------------------------------
// Regression: timer hardware overflow must trigger ISR dispatch end-to-end
//
// All prior interrupt tests pre-set IF manually.  This test lets the timer
// hardware set IF by itself, then verifies the full pipeline:
//   TIMA overflow → IF bit 2 set → ISR dispatched → handler (INC A, RET)
//   runs → IF cleared → IME disabled (RET not RETI, mirrors 02-interrupts.s).
// ---------------------------------------------------------------------------

function testTimerHardwareTriggerISR(): void {
    // HALT so the CPU doesn't wander into leftover bytecode from earlier tests;
    // JR $FE spins safely after HALT exits (ISR fires during the HALT-exit tick).
    setupRomProgram([
        0x76,        // HALT — waits for IE & IF to match, then ISR fires
        0x18, 0xFE,  // JR $-2 — infinite spin (never reaches leftover memory)
    ]);

    // ISR mirrors 02-interrupts.s $50: INC A, RET  (NOT RETI — leaves IME disabled)
    setIntProgram(IntType.Timer, [
        0x3C,  // INC A
        0xC9,  // RET
    ]);

    // Configure: timer ON mode 01 (TIMA increments every 16 T-cycles),
    // TIMA=$FE → overflows after 2 increments = 32 T-cycles.
    MemoryMap.GBstore<u8>(0xFF07, 0x05); // TAC: timer on, mode 01
    MemoryMap.GBstore<u8>(0xFF05, 0xFE); // TIMA near overflow
    MemoryMap.GBstore<u8>(0xFFFF, 0x04); // IE: timer bit
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04); // clear IF timer bit
    Timer.internalDiv = 0;               // align to edge boundary
    Interrupt.masterEnabled = true;      // IME = 1 (as after EI)
    Cpu.SetA(0);

    // 20 ticks × 4 T = 80 T-cycles — well past the 32 T needed for first overflow
    for (let i = 0; i < 20; i++) Emulator.Tick();

    assert(Cpu.A() == 1,
        `Timer ISR must fire when TIMA overflows with IME=1: A=${Cpu.A()} (expected 1)`);
    assert(!Interrupt.masterEnabled,
        `IME must stay disabled after ISR with RET (not RETI): masterEnabled=${Interrupt.masterEnabled}`);
    assert((Interrupt.Requests() & 0x04) == 0,
        `IF timer bit must be cleared by ISR dispatch: IF=${Interrupt.Requests()}`);
}

// ---------------------------------------------------------------------------
// Regression: IF timer bit must persist after second overflow when IME=false
//
// Mirrors 02-interrupts.s test 4's third-delay check:
//   After the first ISR fires with RET (IME=false), the timer keeps running.
//   The second overflow sets IF bit 2 — and it must STAY SET because
//   IME=false prevents a new dispatch from clearing it.
//   The test ROM reads IF at this point and expects bit 2 = 1.
// ---------------------------------------------------------------------------

function testTimerIFPersistsAfterRetISR(): void {
    setupRomProgram([
        0x76,        // HALT — timer keeps running; exits when IE & IF match
        0x18, 0xFE,  // JR $-2 — infinite spin after HALT exits (no ISR since IME=false)
    ]);

    // State matches "just after first ISR returned via RET":
    //   IME=false, TIMA reset to 0 (TMA=0), IF timer bit cleared by dispatch.
    // Set TIMA=$FE again so the next overflow is only 32 T-cycles away.
    MemoryMap.GBstore<u8>(0xFF07, 0x05); // TAC: timer on, mode 01
    MemoryMap.GBstore<u8>(0xFF05, 0xFE); // TIMA near overflow
    MemoryMap.GBstore<u8>(0xFFFF, 0x04); // IE: timer bit still set
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04); // IF cleared (as after dispatch)
    Timer.internalDiv = 0;
    Interrupt.masterEnabled = false;     // IME=false (from RET in previous ISR)

    // 20 ticks × 4 T = 80 T-cycles > 32 T needed for overflow
    for (let i = 0; i < 20; i++) Emulator.Tick();

    assert((Interrupt.Requests() & 0x04) != 0,
        `IF timer bit must be set after overflow with IME=false — ` +
        `timer must keep running and set IF even when IME is disabled. IF=${Interrupt.Requests()}`);
    assert(!Interrupt.masterEnabled,
        `IME must remain false (no ISR dispatch when IME=0): masterEnabled=${Interrupt.masterEnabled}`);
}

export function testInterrupts(): boolean {
    testInt1();
    testIsrDispatchCycles();
    testEiDiCancelsIME();
    testEiEnablesAfterOneInstruction();
    testISRDispatchTakes20TCycles();
    testISRClearsIFBitAndIME();
    testTimerHardwareTriggerISR();
    testTimerIFPersistsAfterRetISR();
    return true;
}
