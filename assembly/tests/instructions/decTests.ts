import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { BC, DE, HL, SP, SetBC, SetDE, SetHL, SetSP, setTestRom } from "../cpuTests";

function RunDec(opCode: u8, a: u8, setA: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
    assert(Cpu.HasFlag(Flag.N_Sub));
}

function RunDec16(opCode: u8, a: u16, setA: (a: u16) => void): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == 8);
}

export function testDec(): boolean {
    RunDec16(0x0B, 43, SetBC) // DEC BC
    assert(BC() == 42, `BC = ${BC()}, expected ${42}`);

    const testFlag: u8 = <u8>(Flag.C_Carry | Flag.N_Sub);
    RunDec16(0x0B, 43, v => { SetBC(v); Cpu.SetF(testFlag) }) // DEC BC
    assert(BC() == 42, `BC = ${BC()}, expected ${42}`);
    assert(Cpu.F() == testFlag, 'unexpected Flags: 0b' + Cpu.F().toString(2));

    RunDec16(0x0B, 0, v => { SetBC(v); Cpu.SetF(testFlag) }) // DEC BC
    assert(BC() == 0xFFFF, `BC = ${BC()}, expected 0xFFFF`);
    assert(Cpu.F() == testFlag, 'unexpected Flags: 0b' + Cpu.F().toString(2));

    RunDec16(0x1B, 43, SetDE) // DEC DE
    assert(DE() == 42, `DE = ${DE()}, expected ${42}`);

    RunDec16(0x2B, 43, SetHL) // DEC HL
    assert(HL() == 42, `HL = ${HL()}, expected ${42}`);

    RunDec16(0x3B, 43, SetSP) // DEC SP
    assert(SP() == 42, `SP = ${SP()}, expected ${42}`);

    // DEC [HL]
    RunDec(0x35, 17, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 12);
    assert(MemoryMap.GBload<u8>(0x42) == 16, `[0x42] = ${MemoryMap.GBload<u8>(0x42)}, expected 16`);
    MemoryMap.GBstore(0x42, 0);

    RunDec(0x05, 43, Cpu.SetB) // DEC B
    assert(Cpu.B() == 42, `B = ${Cpu.B()}, expected ${42}`);

    RunDec(0x0D, 43, Cpu.SetC) // DEC C
    assert(Cpu.C() == 42, `C = ${Cpu.C()}, expected ${42}`);

    RunDec(0x15, 43, Cpu.SetD) // DEC D
    assert(Cpu.D() == 42, `D = ${Cpu.D()}, expected ${42}`);

    RunDec(0x15, 43, Cpu.SetD) // DEC D
    assert(Cpu.D() == 42, `D = ${Cpu.D()}, expected ${42}`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunDec(0x15, 1, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.N_Sub) }) // DEC D
    assert(Cpu.D() == 0, `D = ${Cpu.D()}, expected ${0}`);
    assert(Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.H_HalfC));

    RunDec(0x15, 0, Cpu.SetD) // DEC D
    assert(Cpu.D() == 0xFF, `D = ${Cpu.D()}, expected 0xFF`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(Cpu.HasFlag(Flag.H_HalfC), 'HalfCarry flag not set');

    RunDec(0x15, 0x10, Cpu.SetD) // DEC D
    assert(Cpu.D() == 0xF, `D = ${Cpu.D()}, expected ${0xF}`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(Cpu.HasFlag(Flag.H_HalfC), 'HalfCarry flag set');

    RunDec(0x1D, 43, Cpu.SetE) // DEC E
    assert(Cpu.E() == 42, `E = ${Cpu.E()}, expected ${42}`);

    RunDec(0x25, 43, Cpu.SetH) // DEC H
    assert(Cpu.H() == 42, `H = ${Cpu.H()}, expected ${42}`);

    RunDec(0x2D, 43, Cpu.SetL) // DEC L
    assert(Cpu.L() == 42, `L = ${Cpu.L()}, expected ${42}`);

    RunDec(0x3D, 43, Cpu.SetA) // DEC A
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    return true;
}
