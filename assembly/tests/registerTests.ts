import { Cpu, Flag } from "../cpu/cpu";
import { describe, it, assertReg, assertEquals, assertFlags } from "./framework";

function testDecomposition(): void {
    it("register decomposition", () => {
        Cpu.AF = 0xAAFF;
        Cpu.BC = 0xBBCC;
        Cpu.DE = 0xDDEE;
        Cpu.HL = 0x1122;
        assertReg(Cpu.A(), 0xAA, "A");
        assertReg(Cpu.F(), 0xFF, "F");
        assertReg(Cpu.B(), 0xBB, "B");
        assertReg(Cpu.C(), 0xCC, "C");
        assertReg(Cpu.D(), 0xDD, "D");
        assertReg(Cpu.E(), 0xEE, "E");
        assertReg(Cpu.H(), 0x11, "H");
        assertReg(Cpu.L(), 0x22, "L");
    });
}

function testComposition(): void {
    it("SetA/SetF compose AF", () => {
        Cpu.Init();
        Cpu.AF = 0;
        Cpu.SetA(0xAA);
        assertReg(Cpu.A(), 0xAA, "A");
        assertEquals<u16>(Cpu.AF, 0xAA00, "AF");

        Cpu.SetF(0xFF);
        assertReg(Cpu.F(), 0xFF, "F");
        assertReg(Cpu.A(), 0xAA, "A");
        assertEquals<u16>(Cpu.AF, 0xAAFF, "AF");
    });

    it("SetB/SetC compose BC", () => {
        Cpu.BC = 0;
        Cpu.SetB(0xBB);
        assertReg(Cpu.B(), 0xBB, "B");

        Cpu.SetC(0xCC);
        assertReg(Cpu.C(), 0xCC, "C");
        assertReg(Cpu.B(), 0xBB, "B");
        assertEquals<u16>(Cpu.BC, 0xBBCC, "BC");
    });

    it("SetD/SetE compose DE", () => {
        Cpu.DE = 0;
        Cpu.SetD(0xDD);
        assertReg(Cpu.D(), 0xDD, "D");

        Cpu.SetE(0xEE);
        assertReg(Cpu.E(), 0xEE, "E");
        assertReg(Cpu.D(), 0xDD, "D");
        assertEquals<u16>(Cpu.DE, 0xDDEE, "DE");
    });

    it("SetH/SetL compose HL", () => {
        Cpu.HL = 0;
        Cpu.SetH(0x11);
        assertReg(Cpu.H(), 0x11, "H");

        Cpu.SetL(0x22);
        assertReg(Cpu.L(), 0x22, "L");
        assertReg(Cpu.H(), 0x11, "H");
        assertEquals<u16>(Cpu.HL, 0x1122, "HL");
    });
}

function testSetFlag(initialFlags: u8, flag: Flag, enabled: boolean): u8 {
    Cpu.Init();
    Cpu.SetF(initialFlags);
    Cpu.SetFlag(flag, enabled);
    return Cpu.F();
}

function testFlags(): void {
    it("all flags set when F=0xFF", () => {
        Cpu.AF = 0xAAFF;
        assertFlags(true, true, true, true);
    });
    it("SetFlag clears individual flags", () => {
        assertEquals<u8>(testSetFlag(0b11110000, Flag.Z_Zero, false), 0b001110000, "clear Z");
        assertEquals<u8>(testSetFlag(0b11110000, Flag.N_Sub, false), 0b010110000, "clear N");
        assertEquals<u8>(testSetFlag(0b11110000, Flag.H_HalfC, false), 0b011010000, "clear H");
        assertEquals<u8>(testSetFlag(0b11110000, Flag.C_Carry, false), 0b011100000, "clear C");
    });
    it("SetFlag sets individual flags", () => {
        assertEquals<u8>(testSetFlag(0, Flag.Z_Zero, true), <u8>Flag.Z_Zero, "set Z");
        assertEquals<u8>(testSetFlag(0, Flag.N_Sub, true), <u8>Flag.N_Sub, "set N");
        assertEquals<u8>(testSetFlag(0, Flag.H_HalfC, true), <u8>Flag.H_HalfC, "set H");
        assertEquals<u8>(testSetFlag(0, Flag.C_Carry, true), <u8>Flag.C_Carry, "set C");
    });
}

function testZeroFlagInAF(): void {
    it("Z flag visible from AF", () => {
        Cpu.AF = 0x00FF;
        assert(Cpu.FlagZ());
    });
}

export function testRegisters(): boolean {
    describe("Registers", () => {
        testComposition();
        testDecomposition();
        testFlags();
        testZeroFlagInAF();
    });
    return true;
}
