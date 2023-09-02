import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";

function RunAdd8(addInstruction: u8, a: u8, b: u8, setA: (a: u8) => void, setB: (a: u8) => void): void {
    setTestRom([addInstruction]);
    setA(a);
    setB(b);
    Cpu.Tick();
}

function RunAddToA(addInstruction: u8, a: u8, b: u8, setB: (a: u8) => void): void {
    RunAdd8(addInstruction, a, b, Cpu.SetA, setB);
}

function RunAddToHL(addInstruction: u8, a: u16, b: u16, setB: (a: u16) => void): void {
    setTestRom([addInstruction]);
    Cpu.HL = a;
    setB(b);
    Cpu.Tick();
}

function RunAddToSP(a: u16, b: u8, preExecute: () => void = () => { }): void {
    setTestRom([0xE8, b]);
    Cpu.SetFlag(Flag.N_Sub);
    Cpu.StackPointer = a;
    preExecute();
    Cpu.Tick();
}

function RunAddValue_0xC6(a: u8, b: u8): void {
    setTestRom([0xC6, b]);
    Cpu.SetA(a);
    Cpu.Tick();
}

function RunAddDerefHL_0x86(a: u8, b: u8): void {
    const placeForB: u16 = 0x42;
    RunAddToA(0x86, a, b, (b) => {
        MemoryMap.GBstore<u8>(placeForB, b);
        Cpu.HL = placeForB;
    });
    assert(Cpu.HL == placeForB);
    assert(MemoryMap.GBload<u8>(placeForB) == b);
}

export function testAdd(): boolean {
    RunAddToA(0x80, 2, 5, Cpu.SetB);
    assert(Cpu.A() == 7);
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.C_Carry));

    RunAddToA(0x80, 0, 0, Cpu.SetB);
    assert(Cpu.A() == 0);
    assert(Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.C_Carry));

    RunAddToA(0x80, 0xFE, 1, Cpu.SetB);
    assert(Cpu.A() == 0xFF);
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.C_Carry));

    RunAddToA(0x80, 0xFF, 1, Cpu.SetB);
    assert(Cpu.A() == 0);
    assert(Cpu.HasFlag(Flag.Z_Zero));
    assert(Cpu.HasFlag(Flag.C_Carry));

    RunAddToA(0x80, 0xFF, 0xFF, Cpu.SetB);
    assert(Cpu.A() == 0xFE, Cpu.A().toString(16));
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(Cpu.HasFlag(Flag.C_Carry));

    RunAddToA(0x81, 25, 17, Cpu.SetC);
    assert(Cpu.A() == 42);

    RunAddToA(0x82, 25, 17, Cpu.SetD);
    assert(Cpu.A() == 42);

    RunAddToA(0x83, 25, 17, Cpu.SetE);
    assert(Cpu.A() == 42);

    RunAddToA(0x84, 25, 17, Cpu.SetH);
    assert(Cpu.A() == 42);

    RunAddToA(0x85, 25, 17, Cpu.SetL);
    assert(Cpu.A() == 42);

    RunAddDerefHL_0x86(25, 17);
    assert(Cpu.A() == 42, `Cpu.A = ${Cpu.A()}`);

    RunAddDerefHL_0x86(0, 17);
    assert(Cpu.A() == 17, `Cpu.A = ${Cpu.A()}`);

    RunAddDerefHL_0x86(5, 255);
    assert(Cpu.A() == 4, `Cpu.A = ${Cpu.A()}`);
    assert(Cpu.HasFlag(Flag.C_Carry));

    RunAddToA(0x87, 21, 21, Cpu.SetA);
    assert(Cpu.A() == 42, `Cpu.A = ${Cpu.A()}`);

    RunAddValue_0xC6(25, 17);
    assert(Cpu.A() == 42, `Cpu.A = ${Cpu.A()}`);

    RunAddValue_0xC6(0, 17);
    assert(Cpu.A() == 17, `Cpu.A = ${Cpu.A()}`);

    RunAddValue_0xC6(255, 2);
    assert(Cpu.A() == 1, `Cpu.A = ${Cpu.A()}`);
    assert(Cpu.HasFlag(Flag.C_Carry));

    RunAddValue_0xC6(2, 255);
    assert(Cpu.A() == 1, `Cpu.A = ${Cpu.A()}`);
    assert(Cpu.HasFlag(Flag.C_Carry));

    RunAddToHL(0x09, 25, 17, (v: u16) => Cpu.BC = v);
    assert(Cpu.HL == 42, `Cpu.HL = ${Cpu.HL}`);
    RunAddToHL(0x19, 25, 17, (v: u16) => Cpu.DE = v);
    assert(Cpu.HL == 42, `Cpu.HL = ${Cpu.HL}`);
    RunAddToHL(0x29, 21, 21, (v: u16) => Cpu.HL = v);
    assert(Cpu.HL == 42, `Cpu.HL = ${Cpu.HL}`);
    RunAddToHL(0x39, 25, 17, (v: u16) => Cpu.StackPointer = v);
    assert(Cpu.HL == 42, `Cpu.HL = ${Cpu.HL}`);

    // check that those don't affect Zero flag
    RunAddToHL(0x39, 25, 17, (v: u16) => {
        Cpu.SetF(<u8>Flag.Z_Zero);
        Cpu.StackPointer = v;
    });
    assert(Cpu.HL == 42, `Cpu.HL = ${Cpu.HL}`);
    assert(Cpu.HasFlag(Flag.Z_Zero))

    RunAddToHL(0x39, 0, 0, (v: u16) => Cpu.StackPointer = v);
    assert(Cpu.HL == 0, `Cpu.HL = ${Cpu.HL}`);
    assert(Cpu.HasFlag(Flag.Z_Zero));

    RunAddToSP(0, 0);
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.N_Sub));
    assert(Cpu.StackPointer == 0, `Cpu.StackPointer = ${Cpu.StackPointer}`);

    RunAddToSP(17, 25, () => Cpu.SetF(<u8>Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.N_Sub));
    assert(Cpu.StackPointer == 42, `Cpu.StackPointer = ${Cpu.StackPointer}`);
    return true;
}
