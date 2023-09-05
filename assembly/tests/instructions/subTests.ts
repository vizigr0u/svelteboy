import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";

function RunSub(opCode: u8, a: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    Cpu.SetA(a);
    setB(b);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles, `Cycles: ${Cpu.CycleCount}, expected ${expectedCycles}`);
    assert(Cpu.HasFlag(Flag.N_Sub));
}

function RunSubValue(a: u8, b: u8): void {
    setTestRom([0xd6, b]);
    Cpu.SetA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == 8, `Cycles: ${Cpu.CycleCount}, expected ${8}`);
    assert(Cpu.HasFlag(Flag.N_Sub));
}

export function testSub(): boolean {
    // SUB A, [HL]
    const addr: u16 = 0xFF82;
    RunSub(0x96, 53, 11, v => { MemoryMap.GBstore(addr, v); Cpu.HL = addr }, 8);
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);
    MemoryMap.GBstore(addr, 0);

    RunSub(0x90, 53, 11, Cpu.SetB) // SUB A, B
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    RunSub(0x91, 53, 11, Cpu.SetC) // SUB A, C
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    RunSub(0x92, 53, 11, Cpu.SetD) // SUB A, D
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    RunSub(0x92, 53, 11, Cpu.SetD) // SUB A, D
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunSub(0x92, 53, 53, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.N_Sub) }) // SUB A, D
    assert(Cpu.A() == 0, `A = ${Cpu.A()}, expected ${0}`);
    assert(Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.H_HalfC));

    RunSub(0x92, 0xF2, 3, Cpu.SetD) // SUB A, D
    assert(Cpu.A() == 0xEF, `A = ${Cpu.A()}, expected 0xEF`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(Cpu.HasFlag(Flag.H_HalfC), 'HalfCarry flag not set');

    RunSub(0x92, 0xF5, 3, Cpu.SetD) // SUB A, D
    assert(Cpu.A() == 0xF2, `A = ${Cpu.A()}, expected ${0xF2}`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.H_HalfC), 'HalfCarry flag set');

    RunSub(0x93, 53, 11, Cpu.SetE) // SUB A, E
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    RunSub(0x94, 53, 11, Cpu.SetH) // SUB A, H
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    RunSub(0x95, 53, 11, Cpu.SetL) // SUB A, L
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    RunSub(0x97, 53, 42, Cpu.SetA) // SUB A, A
    assert(Cpu.A() == 0, `A = ${Cpu.A()}, expected ${0}`);

    RunSubValue(53, 11); // SUB A, n8
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    RunSubValue(41, 0xFF); // SUB A, n8
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected ${42}`);

    return true;
}
