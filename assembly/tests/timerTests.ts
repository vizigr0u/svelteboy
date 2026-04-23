import { Timer } from "../io/timer";
import { Interrupt } from "../cpu/interrupts";
import { MemoryMap } from "../memory/memoryMap";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { Cartridge } from "../cartridge";
import { CGBMode } from "../metadata";
import { Emulator } from "../emulator";
import { CgbState } from "../cgbState";
import { setTestRom } from "./cpuTests";
import { describe, it, assertEquals } from "./framework";

const DIV_ADDR:  u16 = 0xFF04;
const TIMA_ADDR: u16 = 0xFF05;
const TMA_ADDR:  u16 = 0xFF06;
const TAC_ADDR:  u16 = 0xFF07;

function setup(): void {
    setTestRom([0x00]);
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04); // clear timer IF
}

// Enable timer with given TAC clock-select bits (0-3).
function timerOn(mode: u8): void {
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x04 | (mode & 0x03));
}

// ── DIV read behavior ──────────────────────────────────────────────────────
// Pandocs: DIV is the visible upper 8 bits of the 16-bit internal counter.

function testDivReadsUpperByte(): void {
    setup();
    Timer.internalDiv = 0x1234;
    assertEquals<u8>(Timer.Div, 0x12, "DIV = internalDiv >> 8");
}

function testDivAfterInit(): void {
    setup();
    // DMG internalDiv = 0xABCC without boot ROM; upper byte = 0xAB (spec: DIV=$AB at $0100)
    assertEquals<u8>(Timer.Div, 0xAB, "DIV after DMG init = 0xAC");
}

function testDivAfterCgbInit(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, CGBMode.CGBOnly as u8);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Cartridge.Data.cgbFlag = CGBMode.CGBOnly as u8;
    Emulator.Init(false);
    // GBC internalDiv = 0xABCC without boot ROM; upper byte = 0xAB
    assertEquals<u8>(Timer.Div, 0xAB, "DIV after CGB init = 0xAB");
    Cartridge.Data.cgbFlag = 0x00;
    CgbState.setIsCGB(false);
}

function testDivViaGBload(): void {
    setup();
    Timer.internalDiv = 0x5600;
    assertEquals<u8>(MemoryMap.GBload<u8>(DIV_ADDR), 0x56, "GBload DIV = internalDiv >> 8");
}

// ── DIV write resets counter ───────────────────────────────────────────────

function testDivWriteResetsCounter(): void {
    setup();
    Timer.internalDiv = 0xABCD;
    MemoryMap.GBstore<u8>(DIV_ADDR, 0xFF); // any write resets to 0
    assertEquals<u16>(Timer.internalDiv, 0, "DIV write resets internalDiv to 0");
}

// ── DIV write triggers TIMA tick (falling-edge glitch) ────────────────────
// Pandocs: "Writing DIV can instantly trigger a timer tick if selected bit was 1."

function testDivWriteTicksTimaWhenBitSet(): void {
    setup();
    timerOn(0x01);           // mode 01: watch bit 3 (period = 16 T)
    Timer.Tima = 0x10;
    Timer.internalDiv = 0x0008; // bit 3 = 1
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    MemoryMap.GBstore<u8>(DIV_ADDR, 0x00); // reset → bit 3 falls → one tick
    assertEquals<u8>(Timer.Tima, 0x11, "DIV write ticks TIMA when watched bit was 1");
}

function testDivWriteNoTickWhenBitClear(): void {
    setup();
    timerOn(0x01);           // mode 01: watch bit 3
    Timer.Tima = 0x10;
    Timer.internalDiv = 0x0004; // bit 3 = 0, no falling edge
    MemoryMap.GBstore<u8>(DIV_ADDR, 0x00);
    assertEquals<u8>(Timer.Tima, 0x10, "DIV write does NOT tick TIMA when watched bit was 0");
}

// ── TAC clock-select change triggers TIMA tick ────────────────────────────
// Pandocs: "Changing TAC clock select from a set bit to a clear bit sends a timer tick."

function testTacClockSelectChangeTicksTimaWhenOldBitSet(): void {
    setup();
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x05); // mode 01 (bit 3), enabled
    Timer.Tima = 0x20;
    Timer.internalDiv = 0x0008;  // bit 3 = 1 (old watched bit)
    // Switch to mode 00 (watch bit 9) — bit 3 was 1, bit 9 = 0 → falling edge
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x04); // mode 00, still enabled
    assertEquals<u8>(Timer.Tima, 0x21,
        "TAC clock-select change ticks TIMA when old watched bit was 1");
}

// ── TAC disable triggers TIMA tick (DMG) ──────────────────────────────────
// Pandocs: "On DMG: disabling timer while selected bit is set sends one tick."

function testTacDisableTicksTimaWhenBitSet(): void {
    setup();
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x05); // mode 01 (bit 3), enabled
    Timer.Tima = 0x30;
    Timer.internalDiv = 0x0008;  // bit 3 = 1
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x01); // mode 01, disabled → bit 3 was 1 → tick
    assertEquals<u8>(Timer.Tima, 0x31,
        "TAC disable ticks TIMA when selected bit was 1 (DMG)");
}

function testTacDisableNoTickWhenBitClear(): void {
    setup();
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x05); // mode 01 (bit 3), enabled
    Timer.Tima = 0x30;
    Timer.internalDiv = 0x0004;  // bit 3 = 0
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x01); // disable — bit was 0, no tick
    assertEquals<u8>(Timer.Tima, 0x30,
        "TAC disable does NOT tick TIMA when selected bit was 0");
}

// ── Basic TIMA overflow → TMA reload + timer interrupt ────────────────────
// Pandocs: "On overflow: reset to TMA, request timer interrupt."

function testTimaOverflowReloadsToTma(): void {
    setup();
    timerOn(0x01);       // mode 01: watch bit 3, period = 16 T
    Timer.Tma  = 0x42;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0;
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    // Cycle A: overflow detected → TIMA=$00, IF not yet set
    Timer.Tick(16);
    assertEquals<u8>(Timer.Tima, 0x00, "Cycle A: TIMA=$00 after overflow");
    assert((Interrupt.Requests() & 0x04) == 0, "Cycle A: IF not yet set");
    // Cycle B: TMA loaded, IF fired
    Timer.Tick(4);
    assertEquals<u8>(Timer.Tima, 0x42, "TIMA overflow reloads to TMA");
    assert((Interrupt.Requests() & 0x04) != 0, "TIMA overflow sets timer IF bit");
}

function testTimaOverflowWithTmaZero(): void {
    setup();
    timerOn(0x01);
    Timer.Tma  = 0x00;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0;
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(16); // cycle A
    Timer.Tick(4);  // cycle B
    assertEquals<u8>(Timer.Tima, 0x00, "TIMA overflow with TMA=0 reloads to 0");
    assert((Interrupt.Requests() & 0x04) != 0, "TIMA overflow with TMA=0 still sets IF");
}

// ── TMA write before overflow uses new value ──────────────────────────────
// Pandocs: TMA is the reload value read at overflow time (cycle B).

function testTmaWriteBeforeOverflowUsesNewValue(): void {
    setup();
    timerOn(0x01);
    Timer.Tma  = 0x10;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0;
    MemoryMap.GBstore<u8>(TMA_ADDR, 0xBB); // update TMA before overflow tick
    Timer.Tick(16); // cycle A
    Timer.Tick(4);  // cycle B: reads Tma=$BB
    assertEquals<u8>(Timer.Tima, 0xBB,
        "TMA written before overflow: new value used for reload");
}

// ── TIMA disabled: no increment ────────────────────────────────────────────

function testTimaNoIncrementWhenDisabled(): void {
    setup();
    // Timer disabled (TAC bit 2 = 0, default after setTestRom)
    Timer.Tima = 0x05;
    Timer.internalDiv = 0;
    Timer.Tick(16);
    assertEquals<u8>(Timer.Tima, 0x05, "TIMA does not increment when timer is disabled");
}

// ── TAC clock-select bits map to correct periods ───────────────────────────
// Pandocs: 00=4096Hz(256M), 01=262144Hz(4M=16T), 10=65536Hz(16M=64T), 11=16384Hz(64M=256T)

function testTacMode01Period(): void {
    setup();
    timerOn(0x01); // bit 3, period = 16 T
    Timer.Tima = 0;
    Timer.internalDiv = 0x0008; // bit 3 = 1, 8 T from next falling edge
    Timer.Tick(8); // 8→16: bit 3 falls → one edge
    assertEquals<u8>(Timer.Tima, 1, "mode 01: TIMA increments every 16 T-cycles");
}

function testTacMode10Period(): void {
    setup();
    timerOn(0x02); // bit 5, period = 64 T
    Timer.Tima = 0;
    Timer.internalDiv = 0x0020; // bit 5 = 1
    Timer.Tick(32); // → 0x40: bit 5 falls → one edge
    assertEquals<u8>(Timer.Tima, 1, "mode 10: TIMA increments every 64 T-cycles");
}

function testTacMode11Period(): void {
    setup();
    timerOn(0x03); // bit 7, period = 256 T
    Timer.Tima = 0;
    Timer.internalDiv = 0x0080; // bit 7 = 1
    Timer.Tick(128); // → 0x100: bit 7 falls → one edge
    assertEquals<u8>(Timer.Tima, 1, "mode 11: TIMA increments every 256 T-cycles");
}

// ── DIV counts even when timer disabled ───────────────────────────────────
// Pandocs: "DIV always counts regardless of TAC bit 2."

function testDivIncrementsWhenTimerDisabled(): void {
    setup();
    // TAC bit2=0 (timer disabled) — don't call timerOn()
    Timer.internalDiv = 0;
    Timer.Tick(255);
    Timer.Tick(1);
    assertEquals<u8>(Timer.Div, 1, "DIV increments even when timer is disabled");
}

// ── Mode 00 period (1024 T-cycles) ────────────────────────────────────────

function testTacMode00Period(): void {
    setup();
    timerOn(0x00); // bit 9, falling edge every 1024 T
    Timer.Tima = 0;
    // Place internalDiv one T before the falling edge of bit 9.
    // bit9=1 at 0x0200 (512); falls at 0x0400 (1024).
    // Set to 0x03FF (1023): bit9=1, one T from falling edge.
    Timer.internalDiv = 0x03FF;
    Timer.Tick(1);
    assertEquals<u8>(Timer.Tima, 1, "mode 00: TIMA increments at 1024 T boundary");
}

// ── TMA determines effective overflow frequency ───────────────────────────
// Pandocs: TMA=$FF → every tick; TMA=$FE → every 2 ticks; TMA=$00 → every 256 ticks.

function testTmaFfInterruptsEveryTick(): void {
    setup();
    timerOn(0x01); // mode 01: every 16 T
    Timer.Tma  = 0xFF;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0;
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(16); // cycle A: overflow → TIMA=$00
    Timer.Tick(4);  // cycle B: TIMA=TMA=$FF, IF set
    assertEquals<u8>(Timer.Tima, 0xFF, "TMA=FF: TIMA reloaded to $FF");
    assert((Interrupt.Requests() & 0x04) != 0, "TMA=FF: IF fired");
    // Next period: TIMA=$FF, one tick → overflow again
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(16); // cycle A: TIMA=$FF overflows to $00
    Timer.Tick(4);  // cycle B: TIMA=$FF again
    assertEquals<u8>(Timer.Tima, 0xFF, "TMA=FF: second overflow also reloads $FF");
    assert((Interrupt.Requests() & 0x04) != 0, "TMA=FF: second IF fired");
}

function testTmaFeTwoTicksPerInterrupt(): void {
    setup();
    timerOn(0x01); // mode 01: every 16 T
    Timer.Tma  = 0xFE;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0;
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(16); // cycle A: TIMA=$FF → $00
    Timer.Tick(4);  // cycle B: TIMA=$FE, IF set
    assertEquals<u8>(Timer.Tima, 0xFE, "TMA=FE: TIMA=$FE after first overflow");
    assert((Interrupt.Requests() & 0x04) != 0, "TMA=FE: IF fired at first overflow");
    // One more tick: $FE → $FF (no overflow yet)
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(16);
    assertEquals<u8>(Timer.Tima, 0xFF, "TMA=FE: TIMA=$FF after second tick (no overflow)");
    assert((Interrupt.Requests() & 0x04) == 0, "TMA=FE: no IF after second tick");
    // One more tick: $FF overflows
    Timer.Tick(16); // cycle A
    Timer.Tick(4);  // cycle B
    assertEquals<u8>(Timer.Tima, 0xFE, "TMA=FE: TIMA=$FE after second overflow");
    assert((Interrupt.Requests() & 0x04) != 0, "TMA=FE: IF fired at second overflow");
}

// ── TAC clock-select: no tick when new watched bit also set ───────────────

function testTacClockSelectNoTickWhenNewBitAlsoSet(): void {
    setup();
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x05); // mode 01 (bit3), enabled
    Timer.Tima = 0x20;
    // bit3=1 AND bit5=1: 0x28 = 40 (bit3=8<40✓, bit5=32<40✓)
    Timer.internalDiv = 0x0028;
    // Switch mode 01→10 (bit3→bit5): old=1, new=1 → no falling edge, no tick
    MemoryMap.GBstore<u8>(TAC_ADDR, 0x06); // mode 10, still enabled
    assertEquals<u8>(Timer.Tima, 0x20,
        "TAC clock-select: no tick when new watched bit is also set");
}

// ── 1 M-cycle overflow delay: cycle A ─────────────────────────────────────
// Pandocs: TIMA=$00 for 1 M-cycle after overflow; TMA not copied, IF not set.

function testTimaOverflowCycleAState(): void {
    setup();
    timerOn(0x01); // every 16 T
    Timer.Tma  = 0x42;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0x0008; // bit3=1, 8 T from falling edge
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(8); // triggers overflow: TIMA=$FF → $00 (cycle A)
    assertEquals<u8>(Timer.Tima, 0x00, "Cycle A: TIMA=$00 (TMA not yet loaded)");
    assert((Interrupt.Requests() & 0x04) == 0, "Cycle A: IF timer bit not yet set");
    assert(Timer.overflowPending, "Cycle A: overflowPending flag set");
}

// ── Write to TIMA on cycle A cancels overflow ─────────────────────────────
// Pandocs: "Write to TIMA on cycle A: overflow cancelled. TMA not copied. IF not set."

function testTimaWriteOnCycleACancelsOverflow(): void {
    setup();
    timerOn(0x01);
    Timer.Tma  = 0x42;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0x0008;
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(8); // cycle A: TIMA=$00, overflowPending=true
    MemoryMap.GBstore<u8>(TIMA_ADDR, 0x99); // write on cycle A → cancel
    assert(!Timer.overflowPending, "Cycle A write: overflowPending cleared");
    Timer.Tick(4); // cycle B: pending=false, no reload
    assertEquals<u8>(Timer.Tima, 0x99, "Cycle A write: TIMA stays at written value");
    assert((Interrupt.Requests() & 0x04) == 0, "Cycle A write: IF never set");
}

// ── Write to TMA between cycle A and B uses new TMA at reload ─────────────
// Pandocs: "Write to TMA on cycle B: new TMA value also copied to TIMA on same cycle."

function testTmaWriteAfterCycleAUsesNewValue(): void {
    setup();
    timerOn(0x01);
    Timer.Tma  = 0x42;
    Timer.Tima = 0xFF;
    Timer.internalDiv = 0x0008;
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>0x04);
    Timer.Tick(8); // cycle A: overflow, pending=true
    MemoryMap.GBstore<u8>(TMA_ADDR, 0xBB); // write new TMA before cycle B
    Timer.Tick(4); // cycle B: TIMA=Tma=$BB (reads updated value)
    assertEquals<u8>(Timer.Tima, 0xBB,
        "TMA write between A and B: new TMA value loaded into TIMA at reload");
    assert((Interrupt.Requests() & 0x04) != 0, "IF still set even with new TMA");
}

export function testTimer(): boolean {
    describe("Timer", () => {
        it("DIV = upper byte of internalDiv", () => { testDivReadsUpperByte(); });
        it("DIV after DMG init = 0xAC", () => { testDivAfterInit(); });
        it("DIV after CGB init = 0xAB", () => { testDivAfterCgbInit(); });
        it("GBload DIV returns upper byte of internalDiv", () => { testDivViaGBload(); });
        it("DIV write resets internalDiv to 0", () => { testDivWriteResetsCounter(); });
        it("DIV write ticks TIMA when watched bit was 1", () => { testDivWriteTicksTimaWhenBitSet(); });
        it("DIV write no tick when watched bit was 0", () => { testDivWriteNoTickWhenBitClear(); });
        it("TAC clock-select change ticks TIMA when old bit was 1", () => { testTacClockSelectChangeTicksTimaWhenOldBitSet(); });
        it("TAC disable ticks TIMA when selected bit was 1 (DMG)", () => { testTacDisableTicksTimaWhenBitSet(); });
        it("TAC disable no tick when selected bit was 0", () => { testTacDisableNoTickWhenBitClear(); });
        it("TIMA overflow reloads to TMA and sets IF", () => { testTimaOverflowReloadsToTma(); });
        it("TIMA overflow with TMA=0 reloads to 0 and sets IF", () => { testTimaOverflowWithTmaZero(); });
        it("TMA write before overflow uses new TMA value", () => { testTmaWriteBeforeOverflowUsesNewValue(); });
        it("TIMA no increment when timer disabled", () => { testTimaNoIncrementWhenDisabled(); });
        it("DIV increments even when timer disabled", () => { testDivIncrementsWhenTimerDisabled(); });
        it("mode 00: TIMA increments every 1024 T-cycles", () => { testTacMode00Period(); });
        it("mode 01: TIMA increments every 16 T-cycles", () => { testTacMode01Period(); });
        it("mode 10: TIMA increments every 64 T-cycles", () => { testTacMode10Period(); });
        it("mode 11: TIMA increments every 256 T-cycles", () => { testTacMode11Period(); });
        it("TMA=FF: interrupt fires every TIMA tick", () => { testTmaFfInterruptsEveryTick(); });
        it("TMA=FE: interrupt fires every 2 TIMA ticks", () => { testTmaFeTwoTicksPerInterrupt(); });
        it("TAC clock-select: no tick when new watched bit also set", () => { testTacClockSelectNoTickWhenNewBitAlsoSet(); });
        it("Cycle A: TIMA=$00, IF not set, overflowPending=true", () => { testTimaOverflowCycleAState(); });
        it("Write to TIMA on cycle A cancels overflow", () => { testTimaWriteOnCycleACancelsOverflow(); });
        it("Write to TMA between cycle A and B: new value used at reload", () => { testTmaWriteAfterCycleAUsesNewValue(); });
    });
    return true;
}
