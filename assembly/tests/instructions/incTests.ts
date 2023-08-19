import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../cpu/memoryMap";
import { BC, DE, HL, SP, SetBC, SetDE, SetHL, SetSP, setTestRom } from "../cpuTests";

function RunInc(opCode: u8, a: u8, setA: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
}

function RunInc16(opCode: u8, a: u16, setA: (a: u16) => void): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == 8);
}

export function testInc(): boolean {
    RunInc16(0x03, 41, SetBC) // INC BC
    assert(BC() == 42, `BC = ${BC()}, expected ${42}`);

    const testFlag: u8 = <u8>(Flag.C_Carry | Flag.N_Sub);
    RunInc16(0x03, 41, v => { SetBC(v); Cpu.SetF(testFlag) }) // INC BC
    assert(BC() == 42, `BC = ${BC()}, expected ${42}`);
    assert(Cpu.F() == testFlag, 'unexpected Flags: 0b' + Cpu.F().toString(2));

    RunInc16(0x03, 0xFFFF, v => { SetBC(v); Cpu.SetF(testFlag) }) // INC BC
    assert(BC() == 0, `BC = ${BC()}, expected ${0}`);
    assert(Cpu.F() == testFlag, 'unexpected Flags: 0b' + Cpu.F().toString(2));

    RunInc16(0x13, 41, SetDE) // INC DE
    assert(DE() == 42, `DE = ${DE()}, expected ${42}`);

    RunInc16(0x23, 41, SetHL) // INC HL
    assert(HL() == 42, `HL = ${HL()}, expected ${42}`);

    RunInc16(0x33, 41, SetSP) // INC SP
    assert(SP() == 42, `SP = ${SP()}, expected ${42}`);

    // INC [HL]
    RunInc(0x34, 17, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 12);
    assert(MemoryMap.GBload<u8>(0x42) == 18, `[0x42] = ${MemoryMap.GBload<u8>(0x42)}, expected 18`);
    MemoryMap.GBstore(0x42, 0);

    RunInc(0x04, 41, Cpu.SetB) // INC B
    assert(Cpu.B() == 42, `B = ${Cpu.B()}, expected ${42}`);

    RunInc(0x0C, 41, Cpu.SetC) // INC C
    assert(Cpu.C() == 42, `C = ${Cpu.C()}, expected ${42}`);

    RunInc(0x14, 41, Cpu.SetD) // INC D
    assert(Cpu.D() == 42, `D = ${Cpu.D()}, expected ${42}`);

    RunInc(0x14, 41, Cpu.SetD) // INC D
    assert(Cpu.D() == 42, `D = ${Cpu.D()}, expected ${42}`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunInc(0x14, 41, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.N_Sub) }) // INC D
    assert(Cpu.D() == 42, `D = ${Cpu.D()}, expected ${42}`);
    assert(!Cpu.HasFlag(Flag.N_Sub));
    assert(!Cpu.HasFlag(Flag.H_HalfC));
    assert(Cpu.HasFlag(Flag.C_Carry));

    RunInc(0x14, 0xFF, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.C_Carry, false); }) // INC D
    assert(Cpu.D() == 0, `D = ${Cpu.D()}, expected ${0}`);
    assert(Cpu.HasFlag(Flag.Z_Zero));
    assert(Cpu.HasFlag(Flag.H_HalfC));
    assert(!Cpu.HasFlag(Flag.C_Carry));

    RunInc(0x14, 0xF, Cpu.SetD) // INC D
    assert(Cpu.D() == 0x10, `D = ${Cpu.D()}, expected ${0x10}`);
    assert(Cpu.HasFlag(Flag.H_HalfC), 'HalfCarry flag not set');

    RunInc(0x1C, 41, Cpu.SetE) // INC E
    assert(Cpu.E() == 42, `E = ${Cpu.E()}, expected ${42}`);

    RunInc(0x24, 41, Cpu.SetH) // INC H
    assert(Cpu.H() == 42, `H = ${Cpu.H()}, expected ${42}`);

    RunInc(0x2C, 41, Cpu.SetL) // INC L
    assert(Cpu.L() == 42, `L = ${Cpu.L()}, expected ${42}`);

    RunInc(0x3C, 41, Cpu.SetA) // INC A
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    return true;
}
