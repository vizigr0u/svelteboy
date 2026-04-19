import { Interrupt, IntType } from "../cpu/interrupts";
import { Joypad } from "../io/joypad";
import { MemoryMap } from "../memory/memoryMap";
import { setTestRom } from "./cpuTests";
import { describe, it, assertEquals } from "./framework";

const JOYP: u16 = 0xFF00;

// Bit 4 = 0 → select D-pad; Bit 5 = 0 → select action buttons (active low)
const SELECT_DPAD:   u8 = 0xEF; // 0b11101111
const SELECT_ACTION: u8 = 0xDF; // 0b11011111

function joypadRead(): u8 { return MemoryMap.GBload<u8>(JOYP); }
function joypadWrite(val: u8): void { MemoryMap.GBstore<u8>(JOYP, val); }
function clearJoypadIF(): void {
    Interrupt.SetRequests(Interrupt.Requests() & ~<u8>IntType.Joypad);
}

// ── Selector register ──────────────────────────────────────────────────────

function testDpadSelectorBits(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    const val = joypadRead();
    // bit 4 must be 0 (D-pad selected), bit 5 must be 1 (actions not selected)
    assertEquals<u8>(val & 0x30, 0x20, "D-pad selected: bit4=0, bit5=1");
}

function testActionSelectorBits(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_ACTION);
    const val = joypadRead();
    // bit 5 must be 0 (actions selected), bit 4 must be 1 (D-pad not selected)
    assertEquals<u8>(val & 0x30, 0x10, "Actions selected: bit5=0, bit4=1");
}

function testDpadSelectorIsolatesActions(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    Joypad.SetKeys(0xF0); // A=0x10, B=0x20, Select=0x40, Start=0x80 — all action buttons
    const val = joypadRead();
    // with D-pad selector, action button state must not bleed into bits 0-3
    assertEquals<u8>(val & 0x0F, 0x0F, "D-pad selector: action buttons must not affect bits 0-3");
}

function testActionSelectorIsolatesDpad(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_ACTION);
    Joypad.SetKeys(0x0F); // Right=1, Left=2, Up=4, Down=8 — all D-pad
    const val = joypadRead();
    // with Actions selector, D-pad state must not bleed into bits 0-3
    assertEquals<u8>(val & 0x0F, 0x0F, "Actions selector: D-pad must not affect bits 0-3");
}

// ── Key press / release states (all 8 keys) ───────────────────────────────
// Pan Docs: pressed = 0 (active low) on bits 0-3.
// D-pad bits: bit0=Right, bit1=Left, bit2=Up, bit3=Down
// Action bits: bit0=A,    bit1=B,    bit2=Select, bit3=Start

function testDpadRight(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    Joypad.SetKeys(0x01); // Right
    assertEquals<u8>(joypadRead() & 0x0F, 0x0E, "Right pressed: bit0=0");
    Joypad.SetKeys(0x00); // release
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "Right released: bit0=1");
}

function testDpadLeft(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    Joypad.SetKeys(0x02); // Left
    assertEquals<u8>(joypadRead() & 0x0F, 0x0D, "Left pressed: bit1=0");
    Joypad.SetKeys(0x00);
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "Left released: bit1=1");
}

function testDpadUp(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    Joypad.SetKeys(0x04); // Up
    assertEquals<u8>(joypadRead() & 0x0F, 0x0B, "Up pressed: bit2=0");
    Joypad.SetKeys(0x00);
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "Up released: bit2=1");
}

function testDpadDown(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    Joypad.SetKeys(0x08); // Down
    assertEquals<u8>(joypadRead() & 0x0F, 0x07, "Down pressed: bit3=0");
    Joypad.SetKeys(0x00);
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "Down released: bit3=1");
}

function testActionA(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_ACTION);
    Joypad.SetKeys(0x10); // A
    assertEquals<u8>(joypadRead() & 0x0F, 0x0E, "A pressed: bit0=0");
    Joypad.SetKeys(0x00);
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "A released: bit0=1");
}

function testActionB(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_ACTION);
    Joypad.SetKeys(0x20); // B
    assertEquals<u8>(joypadRead() & 0x0F, 0x0D, "B pressed: bit1=0");
    Joypad.SetKeys(0x00);
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "B released: bit1=1");
}

function testActionSelect(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_ACTION);
    Joypad.SetKeys(0x40); // Select
    assertEquals<u8>(joypadRead() & 0x0F, 0x0B, "Select pressed: bit2=0");
    Joypad.SetKeys(0x00);
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "Select released: bit2=1");
}

function testActionStart(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_ACTION);
    Joypad.SetKeys(0x80); // Start
    assertEquals<u8>(joypadRead() & 0x0F, 0x07, "Start pressed: bit3=0");
    Joypad.SetKeys(0x00);
    assertEquals<u8>(joypadRead() & 0x0F, 0x0F, "Start released: bit3=1");
}

// ── Joypad interrupt (IF bit 4) on 1→0 P1x edge ──────────────────────────
// Pan Docs: "Fires when P10-P13 go high→low (button pressed)."
// In active-low convention: line goes 0 = pressed → interrupt fires.

function testInterruptOnFirstKeyPress(): void {
    setTestRom([0x00]);
    clearJoypadIF();
    Joypad.SetKeys(0x01); // Right — new key, P10 goes low
    assert(Interrupt.HasRequest(IntType.Joypad),
        "IF bit 4 must be set on first key press (P1x line 1→0 edge)");
}

function testNoInterruptOnRelease(): void {
    setTestRom([0x00]);
    Joypad.SetKeys(0x01); // press Right
    clearJoypadIF();
    Joypad.SetKeys(0x00); // release — no new 1→0 edge
    assert(!Interrupt.HasRequest(IntType.Joypad),
        "IF bit 4 must NOT be set on key release (no 1→0 edge)");
}

function testNoInterruptOnSameKeyState(): void {
    setTestRom([0x00]);
    Joypad.SetKeys(0x01);
    clearJoypadIF();
    Joypad.SetKeys(0x01); // same state — no new bit set
    assert(!Interrupt.HasRequest(IntType.Joypad),
        "IF bit 4 must NOT fire when key state is unchanged");
}

function testInterruptOnAdditionalKeyPress(): void {
    setTestRom([0x00]);
    Joypad.SetKeys(0x10); // A pressed
    clearJoypadIF();
    Joypad.SetKeys(0x30); // A + B — B is new (new 1→0 edge)
    assert(Interrupt.HasRequest(IntType.Joypad),
        "IF bit 4 must fire when an additional key is pressed");
}

// ── Opposite key prevention ───────────────────────────────────────────────
// allowOppositeKeys=false: holding Up blocks Down; holding Left blocks Right.

function testOppositePreventionUpBlocksDown(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    Joypad.allowOppositeKeys = false;
    Joypad.SetKeys(0x04); // Up held
    Joypad.SetKeys(0x0C); // try Up + Down
    // Down (bit 3) must be suppressed; Up (bit 2) must still be pressed
    const val = joypadRead();
    assertEquals<u8>(val & 0x0C, 0x08,
        "Up held: Down must be suppressed (bit3=1), Up still pressed (bit2=0)");
    Joypad.allowOppositeKeys = true;
}

function testOppositePreventionLeftBlocksRight(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    Joypad.allowOppositeKeys = false;
    Joypad.SetKeys(0x02); // Left held
    Joypad.SetKeys(0x03); // try Left + Right
    // Right (bit 0) must be suppressed; Left (bit 1) must still be pressed
    const val = joypadRead();
    assertEquals<u8>(val & 0x03, 0x01,
        "Left held: Right must be suppressed (bit0=1), Left still pressed (bit1=0)");
    Joypad.allowOppositeKeys = true;
}

function testOppositeKeysAllowedByDefault(): void {
    setTestRom([0x00]);
    joypadWrite(SELECT_DPAD);
    // allowOppositeKeys defaults to true
    Joypad.SetKeys(0x04); // Up
    Joypad.SetKeys(0x0C); // Up + Down both allowed
    const val = joypadRead();
    // both Up (bit2) and Down (bit3) must be low (active-low pressed)
    assertEquals<u8>(val & 0x0C, 0x00,
        "allowOppositeKeys=true: both Up and Down pressed simultaneously");
}

// ── Export ────────────────────────────────────────────────────────────────

export function testJoypad(): boolean {
    describe("Joypad", () => {
        it("D-pad selector: bit4=0 bit5=1 in read", () => { testDpadSelectorBits(); });
        it("Actions selector: bit5=0 bit4=1 in read", () => { testActionSelectorBits(); });
        it("D-pad selector isolates action button state", () => { testDpadSelectorIsolatesActions(); });
        it("Actions selector isolates D-pad state", () => { testActionSelectorIsolatesDpad(); });
        it("Right: press=bit0 low, release=bit0 high", () => { testDpadRight(); });
        it("Left: press=bit1 low, release=bit1 high", () => { testDpadLeft(); });
        it("Up: press=bit2 low, release=bit2 high", () => { testDpadUp(); });
        it("Down: press=bit3 low, release=bit3 high", () => { testDpadDown(); });
        it("A: press=bit0 low, release=bit0 high", () => { testActionA(); });
        it("B: press=bit1 low, release=bit1 high", () => { testActionB(); });
        it("Select: press=bit2 low, release=bit2 high", () => { testActionSelect(); });
        it("Start: press=bit3 low, release=bit3 high", () => { testActionStart(); });
        it("IF bit4 set on first key press (1→0 edge)", () => { testInterruptOnFirstKeyPress(); });
        it("IF bit4 not set on key release", () => { testNoInterruptOnRelease(); });
        it("IF bit4 not set when key state unchanged", () => { testNoInterruptOnSameKeyState(); });
        it("IF bit4 set when additional key pressed", () => { testInterruptOnAdditionalKeyPress(); });
        it("allowOppositeKeys=false: Up held blocks Down", () => { testOppositePreventionUpBlocksDown(); });
        it("allowOppositeKeys=false: Left held blocks Right", () => { testOppositePreventionLeftBlocksRight(); });
        it("allowOppositeKeys=true (default): opposite keys both register", () => { testOppositeKeysAllowedByDefault(); });
    });
    return true;
}
