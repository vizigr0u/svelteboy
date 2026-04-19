import { ClearHLDerefTest, SetHLDeref, HLDeref } from ".";
import { Cpu, Flag } from "../../cpu/cpu";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertEquals, assertFlags, assertCycles } from "../framework";

// ---------------------------------------------------------------------------
// ADC
// ---------------------------------------------------------------------------

function testAdc(): void {
    describe("ADC", () => {
        it("ADC A,B no carry-in, no carry-out", () => {
            setTestRom([0x88]);
            Cpu.SetA(0x10); Cpu.SetB(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x15, "A");
            assertFlags(false, false, false, false);
        });
        it("ADC A,B carry-in=1", () => {
            setTestRom([0x88]);
            Cpu.SetA(0x10); Cpu.SetB(0x05); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x16, "A");
            assertFlags(false, false, false, false);
        });
        it("ADC A,B overflow to 0 (Z+C set)", () => {
            setTestRom([0x88]);
            Cpu.SetA(0xFF); Cpu.SetB(0x00); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, false, true, true);
        });
        it("ADC A,C", () => {
            setTestRom([0x89]);
            Cpu.SetA(0x01); Cpu.SetC(0x02); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x04, "A");
        });
        it("ADC A,D", () => {
            setTestRom([0x8A]);
            Cpu.SetA(0x01); Cpu.SetD(0x02); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
        });
        it("ADC A,E", () => {
            setTestRom([0x8B]);
            Cpu.SetA(0x01); Cpu.SetE(0x02); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
        });
        it("ADC A,H", () => {
            setTestRom([0x8C]);
            Cpu.SetA(0x01); Cpu.SetH(0x02); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
        });
        it("ADC A,L", () => {
            setTestRom([0x8D]);
            Cpu.SetA(0x01); Cpu.SetL(0x02); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
        });
        it("ADC A,[HL]", () => {
            setTestRom([0x8E]);
            SetHLDeref(0x05);
            Cpu.SetA(0x03); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x09, "A");
            ClearHLDerefTest();
        });
        it("ADC A,A (doubles + carry)", () => {
            setTestRom([0x8F]);
            Cpu.SetA(0x04); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x09, "A");
        });
        it("ADC A,n8 no carry", () => {
            setTestRom([0xCE, 0x10]);
            Cpu.SetA(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x15, "A");
        });
        it("ADC A,n8 half-carry", () => {
            setTestRom([0xCE, 0x01]);
            Cpu.SetA(0x0F); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x10, "A");
            assertFlags(false, false, true, false);
        });
        it("ADC A,n8 carry-in causes half-carry", () => {
            setTestRom([0xCE, 0x00]);
            Cpu.SetA(0x0F); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x10, "A");
            assertFlags(false, false, true, false);
        });
    });
}

// ---------------------------------------------------------------------------
// SBC
// ---------------------------------------------------------------------------

function testSbc(): void {
    describe("SBC", () => {
        it("SBC A,B no borrow", () => {
            setTestRom([0x98]);
            Cpu.SetA(0x10); Cpu.SetB(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0B, "A");
            assertFlags(false, true, true, false); // H: low nibble 0-5 < 0 → half borrow
        });
        it("SBC A,B borrow-in=1", () => {
            setTestRom([0x98]);
            Cpu.SetA(0x10); Cpu.SetB(0x05); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0A, "A");
            assertFlags(false, true, true, false); // H: 0-5-1 < 0 → half borrow
        });
        it("SBC A,B result is zero", () => {
            setTestRom([0x98]);
            Cpu.SetA(0x05); Cpu.SetB(0x04); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, true, false, false);
        });
        it("SBC A,B underflow (C set)", () => {
            setTestRom([0x98]);
            Cpu.SetA(0x00); Cpu.SetB(0x01); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xFF, "A");
            assertFlags(false, true, true, true);
        });
        it("SBC A,C", () => {
            setTestRom([0x99]);
            Cpu.SetA(0x10); Cpu.SetC(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0B, "A");
        });
        it("SBC A,D", () => {
            setTestRom([0x9A]);
            Cpu.SetA(0x10); Cpu.SetD(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0B, "A");
        });
        it("SBC A,E", () => {
            setTestRom([0x9B]);
            Cpu.SetA(0x10); Cpu.SetE(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0B, "A");
        });
        it("SBC A,H", () => {
            setTestRom([0x9C]);
            Cpu.SetA(0x10); Cpu.SetH(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0B, "A");
        });
        it("SBC A,L", () => {
            setTestRom([0x9D]);
            Cpu.SetA(0x10); Cpu.SetL(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0B, "A");
        });
        it("SBC A,[HL]", () => {
            setTestRom([0x9E]);
            SetHLDeref(0x03);
            Cpu.SetA(0x08); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x04, "A");
            ClearHLDerefTest();
        });
        it("SBC A,A = -carry (carry=0 → 0)", () => {
            setTestRom([0x9F]);
            Cpu.SetA(0x42); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, true, false, false);
        });
        it("SBC A,n8 no borrow", () => {
            setTestRom([0xDE, 0x03]);
            Cpu.SetA(0x0A); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x07, "A");
        });
        it("SBC A,n8 half-borrow (0x10-0x01 borrows low nibble)", () => {
            setTestRom([0xDE, 0x01]);
            Cpu.SetA(0x10); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0F, "A");
            assertFlags(false, true, true, false); // H=true: low nibble 0-1 < 0
        });
        it("SBC A,r8: 4 cycles", () => {
            setTestRom([0x98]);
            Cpu.SetA(0x10); Cpu.SetB(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertCycles(4);
        });
        it("SBC A,[HL]: 8 cycles", () => {
            setTestRom([0x9E]);
            SetHLDeref(0x01);
            Cpu.SetA(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x04, "A");
            assertCycles(8);
            ClearHLDerefTest();
        });
        it("SBC A,n8: 8 cycles", () => {
            setTestRom([0xDE, 0x02]);
            Cpu.SetA(0x05); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
            assertCycles(8);
        });
        it("SBC A,B carry-in causes underflow from zero (0x00-0x00-1=0xFF)", () => {
            setTestRom([0x98]);
            Cpu.SetA(0x00); Cpu.SetB(0x00); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xFF, "A");
            assertFlags(false, true, true, true); // H: 0-0-1<0; C: borrow
        });
    });
}

// ---------------------------------------------------------------------------
// AND
// ---------------------------------------------------------------------------

function testAnd(): void {
    describe("AND", () => {
        it("AND A,B result non-zero", () => {
            setTestRom([0xA0]);
            Cpu.SetA(0xFF); Cpu.SetB(0x0F);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0F, "A");
            assertFlags(false, false, true, false);
        });
        it("AND A,B result zero", () => {
            setTestRom([0xA0]);
            Cpu.SetA(0xF0); Cpu.SetB(0x0F);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, false, true, false);
        });
        it("AND A,C", () => {
            setTestRom([0xA1]);
            Cpu.SetA(0b10101010); Cpu.SetC(0b11001100);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b10001000, "A");
        });
        it("AND A,D", () => {
            setTestRom([0xA2]);
            Cpu.SetA(0xFF); Cpu.SetD(0xAA);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xAA, "A");
        });
        it("AND A,E", () => {
            setTestRom([0xA3]);
            Cpu.SetA(0xFF); Cpu.SetE(0x55);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x55, "A");
        });
        it("AND A,H", () => {
            setTestRom([0xA4]);
            Cpu.SetA(0xFF); Cpu.SetH(0x0F);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x0F, "A");
        });
        it("AND A,L", () => {
            setTestRom([0xA5]);
            Cpu.SetA(0xFF); Cpu.SetL(0xF0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xF0, "A");
        });
        it("AND A,[HL]", () => {
            setTestRom([0xA6]);
            SetHLDeref(0x3C);
            Cpu.SetA(0xFF);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x3C, "A");
            ClearHLDerefTest();
        });
        it("AND A,A (identity)", () => {
            setTestRom([0xA7]);
            Cpu.SetA(0x42);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x42, "A");
            assertFlags(false, false, true, false);
        });
        it("AND A,n8", () => {
            setTestRom([0xE6, 0x0F]);
            Cpu.SetA(0b11110000);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, false, true, false);
        });
    });
}

// ---------------------------------------------------------------------------
// OR
// ---------------------------------------------------------------------------

function testOr(): void {
    describe("OR", () => {
        it("OR A,B non-zero", () => {
            setTestRom([0xB0]);
            Cpu.SetA(0xF0); Cpu.SetB(0x0F);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xFF, "A");
            assertFlags(false, false, false, false);
        });
        it("OR A,B zero (0|0=0)", () => {
            setTestRom([0xB0]);
            Cpu.SetA(0x00); Cpu.SetB(0x00);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, false, false, false);
        });
        it("OR A,C", () => {
            setTestRom([0xB1]);
            Cpu.SetA(0x0F); Cpu.SetC(0xF0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xFF, "A");
        });
        it("OR A,D", () => {
            setTestRom([0xB2]);
            Cpu.SetA(0x01); Cpu.SetD(0x10);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x11, "A");
        });
        it("OR A,E", () => {
            setTestRom([0xB3]);
            Cpu.SetA(0x01); Cpu.SetE(0x02);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
        });
        it("OR A,H", () => {
            setTestRom([0xB4]);
            Cpu.SetA(0x01); Cpu.SetH(0x02);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
        });
        it("OR A,L", () => {
            setTestRom([0xB5]);
            Cpu.SetA(0x01); Cpu.SetL(0x02);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x03, "A");
        });
        it("OR A,[HL]", () => {
            setTestRom([0xB6]);
            SetHLDeref(0x55);
            Cpu.SetA(0xAA);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xFF, "A");
            ClearHLDerefTest();
        });
        it("OR A,A (idempotent)", () => {
            setTestRom([0xB7]);
            Cpu.SetA(0x42);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x42, "A");
            assertFlags(false, false, false, false);
        });
        it("OR A,n8", () => {
            setTestRom([0xF6, 0xF0]);
            Cpu.SetA(0x0F);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xFF, "A");
            assertFlags(false, false, false, false);
        });
    });
}

// ---------------------------------------------------------------------------
// CPL, CCF, SCF
// ---------------------------------------------------------------------------

function testCplCcfScf(): void {
    describe("CPL/CCF/SCF", () => {
        it("CPL inverts all bits", () => {
            setTestRom([0x2F]);
            Cpu.SetA(0b10101010);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b01010101, "A");
            assert(Cpu.FlagN(), "N must be set after CPL");
            assert(Cpu.FlagH(), "H must be set after CPL");
        });
        it("CPL 0x00 → 0xFF", () => {
            setTestRom([0x2F]);
            Cpu.SetA(0x00);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xFF, "A");
        });
        it("SCF sets carry, clears N and H (Z untouched)", () => {
            setTestRom([0x37]);
            Cpu.SetFlag(Flag.N_Sub, 1); Cpu.SetFlag(Flag.H_HalfC, 1); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assert(!Cpu.FlagN(), "N cleared by SCF");
            assert(!Cpu.FlagH(), "H cleared by SCF");
            assert(Cpu.FlagC(), "C set by SCF");
        });
        it("SCF keeps carry if already set", () => {
            setTestRom([0x37]);
            Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assert(Cpu.FlagC(), "carry must remain set after SCF");
        });
        it("CCF flips carry 0→1, clears N and H (Z untouched)", () => {
            setTestRom([0x3F]);
            Cpu.SetFlag(Flag.C_Carry, 0); Cpu.SetFlag(Flag.N_Sub, 1); Cpu.SetFlag(Flag.H_HalfC, 1);
            Cpu.Tick();
            assert(Cpu.FlagC(), "C flipped to 1");
            assert(!Cpu.FlagN(), "N cleared by CCF");
            assert(!Cpu.FlagH(), "H cleared by CCF");
        });
        it("CCF flips carry 1→0", () => {
            setTestRom([0x3F]);
            Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assert(!Cpu.FlagC(), "carry must be cleared after CCF");
            assert(!Cpu.FlagN(), "N cleared by CCF");
            assert(!Cpu.FlagH(), "H cleared by CCF");
        });
        it("CPL preserves Z and C flags", () => {
            setTestRom([0x2F]);
            Cpu.SetA(0xFF);
            Cpu.SetFlag(Flag.Z_Zero, 1); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assert(Cpu.FlagZ(), "Z preserved by CPL");
            assert(Cpu.FlagC(), "C preserved by CPL");
            assert(Cpu.FlagN(), "N set by CPL");
            assert(Cpu.FlagH(), "H set by CPL");
            assertCycles(4);
        });
        it("SCF preserves Z flag", () => {
            setTestRom([0x37]);
            Cpu.SetFlag(Flag.Z_Zero, 1); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.SetFlag(Flag.N_Sub, 1); Cpu.SetFlag(Flag.H_HalfC, 1);
            Cpu.Tick();
            assert(Cpu.FlagZ(), "Z preserved by SCF");
            assert(Cpu.FlagC(), "C set by SCF");
            assert(!Cpu.FlagN(), "N cleared by SCF");
            assert(!Cpu.FlagH(), "H cleared by SCF");
            assertCycles(4);
        });
        it("CCF preserves Z flag", () => {
            setTestRom([0x3F]);
            Cpu.SetFlag(Flag.Z_Zero, 1); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.SetFlag(Flag.N_Sub, 1); Cpu.SetFlag(Flag.H_HalfC, 1);
            Cpu.Tick();
            assert(Cpu.FlagZ(), "Z preserved by CCF");
            assert(Cpu.FlagC(), "C flipped to 1");
            assert(!Cpu.FlagN(), "N cleared by CCF");
            assert(!Cpu.FlagH(), "H cleared by CCF");
            assertCycles(4);
        });
    });
}

// ---------------------------------------------------------------------------
// DAA
// ---------------------------------------------------------------------------

function testDaa(): void {
    describe("DAA", () => {
        it("DAA after ADD: 0x0A lower nibble >9 → +6 → 0x10", () => {
            // Simulate result of 9+1=0x0A with N=0, H=0, C=0
            setTestRom([0x27]);
            Cpu.SetA(0x0A);
            Cpu.SetFlag(Flag.N_Sub, 0); Cpu.SetFlag(Flag.H_HalfC, 0); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x10, "A after DAA");
            assert(!Cpu.FlagN(), "N clear after add-mode DAA");
        });
        it("DAA after ADD: 0x7D (45+38 raw) → 0x83", () => {
            // 0x45 + 0x38 = 0x7D: lower nibble D > 9 → +6
            setTestRom([0x27]);
            Cpu.SetA(0x7D);
            Cpu.SetFlag(Flag.N_Sub, 0); Cpu.SetFlag(Flag.H_HalfC, 0); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x83, "A after DAA");
        });
        it("DAA after ADD with carry: 0x9A → 0x00 + Z + C", () => {
            // Simulate 0x99+0x01=0x9A result with N=0
            setTestRom([0x27]);
            Cpu.SetA(0x9A);
            Cpu.SetFlag(Flag.N_Sub, 0); Cpu.SetFlag(Flag.H_HalfC, 0); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A after DAA overflow");
            assert(Cpu.FlagZ(), "Z set after DAA result=0");
            assert(Cpu.FlagC(), "C set after BCD overflow");
        });
        it("DAA after SUB: 0x1F (0x20-0x01 raw) with H → 0x19", () => {
            // 0x20 - 0x01 = 0x1F: N=1, H=1 (lower nibble borrow)
            setTestRom([0x27]);
            Cpu.SetA(0x1F);
            Cpu.SetFlag(Flag.N_Sub, 1); Cpu.SetFlag(Flag.H_HalfC, 1); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x19, "A after sub DAA");
            assert(Cpu.FlagN(), "N preserved in sub-mode DAA");
        });
        it("DAA after ADD: H set (no nibble overflow) → lower correction", () => {
            // 0x09+0x09=0x12 raw: H=1, N=0, C=0 → +6 → 0x18
            setTestRom([0x27]);
            Cpu.SetA(0x12);
            Cpu.SetFlag(Flag.N_Sub, 0); Cpu.SetFlag(Flag.H_HalfC, 1); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x18, "A after H-correction");
            assert(!Cpu.FlagH(), "H always cleared by DAA");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("DAA after ADD: upper nibble >9, no H, no C → +0x60 → carry set", () => {
            // simulate 0x90+0x15=0xA5: lower nibble 5 not >9, H=0 → no low fix; A>0x99 → +0x60
            setTestRom([0x27]);
            Cpu.SetA(0xA5);
            Cpu.SetFlag(Flag.N_Sub, 0); Cpu.SetFlag(Flag.H_HalfC, 0); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x05, "A after upper correction");
            assert(Cpu.FlagC(), "C set on upper correction");
            assert(!Cpu.FlagH(), "H cleared by DAA");
            assert(!Cpu.FlagZ(), "Z clear (result 0x05 != 0)");
        });
        it("DAA after ADD: H + upper correction → double fix", () => {
            // A=0xA2, H=1: lower fix: 0xA2+6=0xA8; upper fix: 0xA8>0x99 → +0x60 → 0x08, C=1
            setTestRom([0x27]);
            Cpu.SetA(0xA2);
            Cpu.SetFlag(Flag.N_Sub, 0); Cpu.SetFlag(Flag.H_HalfC, 1); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x08, "A after double correction");
            assert(Cpu.FlagC(), "C set");
            assert(!Cpu.FlagH(), "H cleared by DAA");
        });
        it("DAA after SUB: C flag → -0x60, C unchanged", () => {
            // simulate borrow: N=1, C=1, H=0 → A-=0x60
            setTestRom([0x27]);
            Cpu.SetA(0x72);
            Cpu.SetFlag(Flag.N_Sub, 1); Cpu.SetFlag(Flag.H_HalfC, 0); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x12, "A after sub C correction");
            assert(Cpu.FlagN(), "N preserved");
            assert(Cpu.FlagC(), "C unchanged in sub mode");
            assert(!Cpu.FlagH(), "H cleared by DAA");
        });
        it("DAA after SUB: C and H → -6 and -0x60", () => {
            // N=1, C=1, H=1 → A=0x6E: -6 → 0x68; -0x60 → 0x08
            setTestRom([0x27]);
            Cpu.SetA(0x6E);
            Cpu.SetFlag(Flag.N_Sub, 1); Cpu.SetFlag(Flag.H_HalfC, 1); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x08, "A after sub C+H correction");
            assert(!Cpu.FlagH(), "H cleared by DAA");
        });
        it("DAA: 4 cycles", () => {
            setTestRom([0x27]);
            Cpu.SetA(0x00);
            Cpu.SetFlag(Flag.N_Sub, 0); Cpu.SetFlag(Flag.H_HalfC, 0); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertCycles(4);
        });
    });
}

// ---------------------------------------------------------------------------
// Accumulator rotates (non-CB): RLCA, RRCA, RLA, RRA
// ---------------------------------------------------------------------------

function testAccumulatorRotates(): void {
    describe("RLCA/RRCA/RLA/RRA", () => {
        it("RLCA rotates left, MSB→carry, Z always 0", () => {
            setTestRom([0x07]);
            Cpu.SetA(0b10110001); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b01100011, "A");
            assertFlags(false, false, false, true); // C=MSB=1
        });
        it("RLCA MSB=0 → carry=0", () => {
            setTestRom([0x07]);
            Cpu.SetA(0b01000000);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b10000000, "A");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("RRCA rotates right, LSB→carry, Z always 0", () => {
            setTestRom([0x0F]);
            Cpu.SetA(0b10110001);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b11011000, "A"); // LSB=1 goes to MSB
            assertFlags(false, false, false, true);
        });
        it("RRCA LSB=0 → carry=0", () => {
            setTestRom([0x0F]);
            Cpu.SetA(0b10000000);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b01000000, "A");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("RLA rotates left through carry, Z always 0", () => {
            setTestRom([0x17]);
            Cpu.SetA(0b10110001); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b01100011, "A"); // old carry into bit0
            assertFlags(false, false, false, true); // new carry = old bit7
        });
        it("RLA carry-in=0 shifts 0 into bit0", () => {
            setTestRom([0x17]);
            Cpu.SetA(0b00000001); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b00000010, "A");
            assert(!Cpu.FlagC(), "carry=0");
        });
        it("RRA rotates right through carry, Z always 0", () => {
            setTestRom([0x1F]);
            Cpu.SetA(0b10110000); Cpu.SetFlag(Flag.C_Carry, 1);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b11011000, "A"); // old carry into bit7
            assertFlags(false, false, false, false); // bit0 was 0 → carry=0
        });
        it("RRA LSB=1 → carry=1", () => {
            setTestRom([0x1F]);
            Cpu.SetA(0b00000001); Cpu.SetFlag(Flag.C_Carry, 0);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b00000000, "A");
            assertFlags(false, false, false, true); // carry = old LSB
        });
    });
}

// ---------------------------------------------------------------------------
// CB-prefixed SWAP
// ---------------------------------------------------------------------------

function testSwap(): void {
    describe("SWAP", () => {
        it("SWAP B swaps nibbles", () => {
            setTestRom([0xCB, 0x30]);
            Cpu.SetB(0xAB);
            Cpu.Tick();
            assertReg(Cpu.B(), 0xBA, "B");
            assertFlags(false, false, false, false);
        });
        it("SWAP C swaps nibbles", () => {
            setTestRom([0xCB, 0x31]);
            Cpu.SetC(0x12);
            Cpu.Tick();
            assertReg(Cpu.C(), 0x21, "C");
        });
        it("SWAP D", () => {
            setTestRom([0xCB, 0x32]);
            Cpu.SetD(0xF0);
            Cpu.Tick();
            assertReg(Cpu.D(), 0x0F, "D");
        });
        it("SWAP E", () => {
            setTestRom([0xCB, 0x33]);
            Cpu.SetE(0x34);
            Cpu.Tick();
            assertReg(Cpu.E(), 0x43, "E");
        });
        it("SWAP H", () => {
            setTestRom([0xCB, 0x34]);
            Cpu.SetH(0x56);
            Cpu.Tick();
            assertReg(Cpu.H(), 0x65, "H");
        });
        it("SWAP L", () => {
            setTestRom([0xCB, 0x35]);
            Cpu.SetL(0x78);
            Cpu.Tick();
            assertReg(Cpu.L(), 0x87, "L");
        });
        it("SWAP [HL]", () => {
            setTestRom([0xCB, 0x36]);
            SetHLDeref(0x9A);
            Cpu.Tick();
            assertEquals<u16>(HLDeref(), 0xA9, "[HL]");
            ClearHLDerefTest();
        });
        it("SWAP A", () => {
            setTestRom([0xCB, 0x37]);
            Cpu.SetA(0xCD);
            Cpu.Tick();
            assertReg(Cpu.A(), 0xDC, "A");
        });
        it("SWAP 0x00 → Z flag set", () => {
            setTestRom([0xCB, 0x30]);
            Cpu.SetB(0x00);
            Cpu.Tick();
            assertReg(Cpu.B(), 0x00, "B");
            assertFlags(true, false, false, false);
        });
    });
}

// ---------------------------------------------------------------------------
// CB-prefixed SLA
// ---------------------------------------------------------------------------

function testSla(): void {
    describe("SLA", () => {
        it("SLA B shifts left, bit7→carry", () => {
            setTestRom([0xCB, 0x20]);
            Cpu.SetB(0b10110001);
            Cpu.Tick();
            assertReg(Cpu.B(), 0b01100010, "B");
            assertFlags(false, false, false, true);
        });
        it("SLA C no carry", () => {
            setTestRom([0xCB, 0x21]);
            Cpu.SetC(0b01000001);
            Cpu.Tick();
            assertReg(Cpu.C(), 0b10000010, "C");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("SLA D zero result", () => {
            setTestRom([0xCB, 0x22]);
            Cpu.SetD(0b10000000);
            Cpu.Tick();
            assertReg(Cpu.D(), 0x00, "D");
            assertFlags(true, false, false, true);
        });
        it("SLA E", () => {
            setTestRom([0xCB, 0x23]);
            Cpu.SetE(0x01);
            Cpu.Tick();
            assertReg(Cpu.E(), 0x02, "E");
        });
        it("SLA H", () => {
            setTestRom([0xCB, 0x24]);
            Cpu.SetH(0x01);
            Cpu.Tick();
            assertReg(Cpu.H(), 0x02, "H");
        });
        it("SLA L", () => {
            setTestRom([0xCB, 0x25]);
            Cpu.SetL(0x01);
            Cpu.Tick();
            assertReg(Cpu.L(), 0x02, "L");
        });
        it("SLA [HL]", () => {
            setTestRom([0xCB, 0x26]);
            SetHLDeref(0b11000000);
            Cpu.Tick();
            assertEquals<u16>(HLDeref(), 0b10000000, "[HL]");
            assert(Cpu.FlagC(), "carry from MSB");
            ClearHLDerefTest();
        });
        it("SLA A", () => {
            setTestRom([0xCB, 0x27]);
            Cpu.SetA(0x40);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x80, "A");
            assert(!Cpu.FlagC(), "no carry");
        });
    });
}

// ---------------------------------------------------------------------------
// CB-prefixed SRA
// ---------------------------------------------------------------------------

function testSra(): void {
    describe("SRA", () => {
        it("SRA B arithmetic shift right (MSB preserved)", () => {
            setTestRom([0xCB, 0x28]);
            Cpu.SetB(0b10110010);
            Cpu.Tick();
            assertReg(Cpu.B(), 0b11011001, "B"); // bit7 preserved
            assertFlags(false, false, false, false);
        });
        it("SRA C bit0→carry", () => {
            setTestRom([0xCB, 0x29]);
            Cpu.SetC(0b00000001);
            Cpu.Tick();
            assertReg(Cpu.C(), 0b00000000, "C");
            assertFlags(true, false, false, true);
        });
        it("SRA D positive number", () => {
            setTestRom([0xCB, 0x2A]);
            Cpu.SetD(0b01000000);
            Cpu.Tick();
            assertReg(Cpu.D(), 0b00100000, "D");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("SRA E", () => {
            setTestRom([0xCB, 0x2B]);
            Cpu.SetE(0xFF);
            Cpu.Tick();
            assertReg(Cpu.E(), 0xFF, "E"); // 0xFF arithmetic right = 0xFF
            assert(Cpu.FlagC(), "carry");
        });
        it("SRA H", () => {
            setTestRom([0xCB, 0x2C]);
            Cpu.SetH(0x80);
            Cpu.Tick();
            assertReg(Cpu.H(), 0xC0, "H");
        });
        it("SRA L", () => {
            setTestRom([0xCB, 0x2D]);
            Cpu.SetL(0x04);
            Cpu.Tick();
            assertReg(Cpu.L(), 0x02, "L");
        });
        it("SRA [HL]", () => {
            setTestRom([0xCB, 0x2E]);
            SetHLDeref(0b10000010);
            Cpu.Tick();
            assertEquals<u16>(HLDeref(), 0b11000001, "[HL]");
            ClearHLDerefTest();
        });
        it("SRA A", () => {
            setTestRom([0xCB, 0x2F]);
            Cpu.SetA(0b00001000);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b00000100, "A");
        });
    });
}

// ---------------------------------------------------------------------------
// CB-prefixed SRL
// ---------------------------------------------------------------------------

function testSrl(): void {
    describe("SRL", () => {
        it("SRL B logical shift right (MSB always 0)", () => {
            setTestRom([0xCB, 0x38]);
            Cpu.SetB(0b10110010);
            Cpu.Tick();
            assertReg(Cpu.B(), 0b01011001, "B"); // bit7 NOT preserved
            assertFlags(false, false, false, false);
        });
        it("SRL C bit0→carry", () => {
            setTestRom([0xCB, 0x39]);
            Cpu.SetC(0b00000001);
            Cpu.Tick();
            assertReg(Cpu.C(), 0b00000000, "C");
            assertFlags(true, false, false, true);
        });
        it("SRL D MSB=1 becomes 0 (unlike SRA)", () => {
            setTestRom([0xCB, 0x3A]);
            Cpu.SetD(0b10000000);
            Cpu.Tick();
            assertReg(Cpu.D(), 0b01000000, "D");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("SRL E", () => {
            setTestRom([0xCB, 0x3B]);
            Cpu.SetE(0x04);
            Cpu.Tick();
            assertReg(Cpu.E(), 0x02, "E");
        });
        it("SRL H", () => {
            setTestRom([0xCB, 0x3C]);
            Cpu.SetH(0x08);
            Cpu.Tick();
            assertReg(Cpu.H(), 0x04, "H");
        });
        it("SRL L", () => {
            setTestRom([0xCB, 0x3D]);
            Cpu.SetL(0x10);
            Cpu.Tick();
            assertReg(Cpu.L(), 0x08, "L");
        });
        it("SRL [HL]", () => {
            setTestRom([0xCB, 0x3E]);
            SetHLDeref(0b11111110);
            Cpu.Tick();
            assertEquals<u16>(HLDeref(), 0b01111111, "[HL]");
            assert(!Cpu.FlagC(), "LSB was 0");
            ClearHLDerefTest();
        });
        it("SRL A", () => {
            setTestRom([0xCB, 0x3F]);
            Cpu.SetA(0xFF);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x7F, "A");
            assert(Cpu.FlagC(), "carry from LSB=1");
        });
    });
}

// ---------------------------------------------------------------------------
// CB-prefixed RLC
// ---------------------------------------------------------------------------

function testRlc(): void {
    describe("RLC (CB)", () => {
        it("RLC B: bit7→carry and bit0", () => {
            setTestRom([0xCB, 0x00]);
            Cpu.SetB(0b10110001);
            Cpu.Tick();
            assertReg(Cpu.B(), 0b01100011, "B"); // rotated left, bit7→bit0
            assertFlags(false, false, false, true);
        });
        it("RLC B: MSB=0 no carry", () => {
            setTestRom([0xCB, 0x00]);
            Cpu.SetB(0b01000000);
            Cpu.Tick();
            assertReg(Cpu.B(), 0b10000000, "B");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("RLC C", () => {
            setTestRom([0xCB, 0x01]);
            Cpu.SetC(0b00000001);
            Cpu.Tick();
            assertReg(Cpu.C(), 0b00000010, "C");
        });
        it("RLC D", () => {
            setTestRom([0xCB, 0x02]);
            Cpu.SetD(0x80);
            Cpu.Tick();
            assertReg(Cpu.D(), 0x01, "D");
            assertFlags(false, false, false, true);
        });
        it("RLC E", () => {
            setTestRom([0xCB, 0x03]);
            Cpu.SetE(0x01);
            Cpu.Tick();
            assertReg(Cpu.E(), 0x02, "E");
        });
        it("RLC H", () => {
            setTestRom([0xCB, 0x04]);
            Cpu.SetH(0x01);
            Cpu.Tick();
            assertReg(Cpu.H(), 0x02, "H");
        });
        it("RLC L", () => {
            setTestRom([0xCB, 0x05]);
            Cpu.SetL(0x01);
            Cpu.Tick();
            assertReg(Cpu.L(), 0x02, "L");
        });
        it("RLC [HL]", () => {
            setTestRom([0xCB, 0x06]);
            SetHLDeref(0b11000001);
            Cpu.Tick();
            assertEquals<u16>(HLDeref(), 0b10000011, "[HL]");
            assert(Cpu.FlagC(), "carry from bit7");
            ClearHLDerefTest();
        });
        it("RLC A zero result sets Z", () => {
            setTestRom([0xCB, 0x07]);
            Cpu.SetA(0x00);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, false, false, false);
        });
        it("RLC A non-zero", () => {
            setTestRom([0xCB, 0x07]);
            Cpu.SetA(0b10000001);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b00000011, "A");
            assertFlags(false, false, false, true);
        });
    });
}

// ---------------------------------------------------------------------------
// CB-prefixed RRC
// ---------------------------------------------------------------------------

function testRrc(): void {
    describe("RRC (CB)", () => {
        it("RRC B: bit0→carry and bit7", () => {
            setTestRom([0xCB, 0x08]);
            Cpu.SetB(0b10110001);
            Cpu.Tick();
            assertReg(Cpu.B(), 0b11011000, "B"); // rotated right, bit0→bit7
            assertFlags(false, false, false, true);
        });
        it("RRC B: LSB=0 no carry", () => {
            setTestRom([0xCB, 0x08]);
            Cpu.SetB(0b00000010);
            Cpu.Tick();
            assertReg(Cpu.B(), 0b00000001, "B");
            assert(!Cpu.FlagC(), "no carry");
        });
        it("RRC C", () => {
            setTestRom([0xCB, 0x09]);
            Cpu.SetC(0x01);
            Cpu.Tick();
            assertReg(Cpu.C(), 0x80, "C");
            assert(Cpu.FlagC(), "carry");
        });
        it("RRC D", () => {
            setTestRom([0xCB, 0x0A]);
            Cpu.SetD(0x80);
            Cpu.Tick();
            assertReg(Cpu.D(), 0x40, "D");
        });
        it("RRC E", () => {
            setTestRom([0xCB, 0x0B]);
            Cpu.SetE(0x04);
            Cpu.Tick();
            assertReg(Cpu.E(), 0x02, "E");
        });
        it("RRC H", () => {
            setTestRom([0xCB, 0x0C]);
            Cpu.SetH(0x08);
            Cpu.Tick();
            assertReg(Cpu.H(), 0x04, "H");
        });
        it("RRC L", () => {
            setTestRom([0xCB, 0x0D]);
            Cpu.SetL(0x10);
            Cpu.Tick();
            assertReg(Cpu.L(), 0x08, "L");
        });
        it("RRC [HL]", () => {
            setTestRom([0xCB, 0x0E]);
            SetHLDeref(0b10000011);
            Cpu.Tick();
            assertEquals<u16>(HLDeref(), 0b11000001, "[HL]");
            assert(Cpu.FlagC(), "carry from bit0");
            ClearHLDerefTest();
        });
        it("RRC A zero result sets Z", () => {
            setTestRom([0xCB, 0x0F]);
            Cpu.SetA(0x00);
            Cpu.Tick();
            assertReg(Cpu.A(), 0x00, "A");
            assertFlags(true, false, false, false);
        });
        it("RRC A non-zero", () => {
            setTestRom([0xCB, 0x0F]);
            Cpu.SetA(0b10000001);
            Cpu.Tick();
            assertReg(Cpu.A(), 0b11000000, "A");
            assertFlags(false, false, false, true);
        });
    });
}

export function testAlu(): boolean {
    testAdc();
    testSbc();
    testAnd();
    testOr();
    testCplCcfScf();
    testDaa();
    testAccumulatorRotates();
    testSwap();
    testSla();
    testSra();
    testSrl();
    testRlc();
    testRrc();
    return true;
}
