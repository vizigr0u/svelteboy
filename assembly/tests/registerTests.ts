import { Cpu, Flag } from "../cpu"

function testDecomposition(): void {
    Cpu.AF = 0xAAFF;
    Cpu.BC = 0xBBCC;
    Cpu.DE = 0xDDEE;
    Cpu.HL = 0x1122;
    assert(Cpu.A() == 0xAA);
    assert(Cpu.F() == 0xFF);
    assert(Cpu.B() == 0xBB);
    assert(Cpu.C() == 0xCC);
    assert(Cpu.D() == 0xDD);
    assert(Cpu.E() == 0xEE);
    assert(Cpu.H() == 0x11);
    assert(Cpu.L() == 0x22);
}

function testComposition(): void {
    Cpu.init();

    Cpu.AF = 0;
    Cpu.SetA(0xAA);
    assert(Cpu.A() == 0xAA);
    assert(Cpu.AF == 0xAA00);

    Cpu.SetF(0xFF);
    assert(Cpu.F() == 0xFF);
    assert(Cpu.A() == 0xAA);
    assert(Cpu.AF == 0xAAFF);

    Cpu.BC = 0;
    Cpu.SetB(0xBB);
    assert(Cpu.B() == 0xBB);

    Cpu.SetC(0xCC);
    assert(Cpu.C() == 0xCC);
    assert(Cpu.B() == 0xBB);
    assert(Cpu.BC == 0xBBCC);

    Cpu.DE = 0;
    Cpu.SetD(0xDD);
    assert(Cpu.D() == 0xDD);

    Cpu.SetE(0xEE);
    assert(Cpu.E() == 0xEE);
    assert(Cpu.D() == 0xDD);
    assert(Cpu.DE == 0xDDEE);

    Cpu.HL = 0;
    Cpu.SetH(0x11);
    assert(Cpu.H() == 0x11);

    Cpu.SetL(0x22);
    assert(Cpu.L() == 0x22);
    assert(Cpu.H() == 0x11);
    assert(Cpu.HL == 0x1122);
}

function testSetFlag(initialFlags: u8, flag: Flag, enabled: boolean): u8 {
    Cpu.init();
    Cpu.SetF(initialFlags);
    Cpu.SetFlag(flag, enabled);
    return Cpu.F();
}

function testFlags(): void {
    Cpu.AF = 0xAAFF;
    assert(Cpu.HasFlag(Flag.Z_Zero));
    assert(Cpu.HasFlag(Flag.N_Sub));
    assert(Cpu.HasFlag(Flag.H_HalfC));
    assert(Cpu.HasFlag(Flag.C_Carry));
    assert(testSetFlag(0b11110000, Flag.Z_Zero, false) == 0b001110000);
    assert(testSetFlag(0b11110000, Flag.N_Sub, false) == 0b010110000);
    assert(testSetFlag(0b11110000, Flag.H_HalfC, false) == 0b011010000);
    assert(testSetFlag(0b11110000, Flag.C_Carry, false) == 0b011100000);
    assert(testSetFlag(0, Flag.Z_Zero, true) == <u8>Flag.Z_Zero);
    assert(testSetFlag(0, Flag.N_Sub, true) == <u8>Flag.N_Sub);
    assert(testSetFlag(0, Flag.H_HalfC, true) == <u8>Flag.H_HalfC);
    assert(testSetFlag(0, Flag.C_Carry, true) == <u8>Flag.C_Carry);
}

function testZeroFlaginAF(): void {
    Cpu.AF = 0x00FF;
    assert(Cpu.HasFlag(Flag.Z_Zero));
}

export function testRegisters(): boolean {
    testComposition();
    testDecomposition();
    testFlags();
    testZeroFlaginAF();
    return true;
}
