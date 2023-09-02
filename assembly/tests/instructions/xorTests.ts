import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";

function RunXor(opCode: u8, a: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    Cpu.SetA(a);
    setB(b);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
}

function RunXorValue(a: u8, b: u8): void {
    setTestRom([0xEE, b]);
    Cpu.SetA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == 8);
}

export function testXor(): boolean {
    RunXor(0xA8, 17, 25, Cpu.SetB); // XOR A, B
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunXor(0xA8, 42, 42, Cpu.SetB); // XOR A, B
    assert(Cpu.A() == 0, `A = ${Cpu.A()}, expected 0`);
    assert(Cpu.HasFlag(Flag.Z_Zero));

    RunXor(0xA9, 17, 25, Cpu.SetC); // XOR A, C
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);

    RunXor(0xAA, 17, 25, Cpu.SetD); // XOR A, D
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);

    RunXor(0xAB, 17, 25, Cpu.SetE); // XOR A, E
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);

    RunXor(0xAC, 17, 25, Cpu.SetH); // XOR A, H
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);

    RunXor(0xAD, 17, 25, Cpu.SetL); // XOR A, L
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);

    // XOR A, [HL]
    RunXor(0xAE, 17, 25, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 8);
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);
    MemoryMap.GBstore(0x42, 0);

    RunXor(0xAF, 17, 25, Cpu.SetB); // XOR A, A
    assert(Cpu.A() == 0, `A = ${Cpu.A()}, expected 0`);
    assert(Cpu.HasFlag(Flag.Z_Zero));

    RunXorValue(17, 25); // XOR A, n8
    assert(Cpu.A() == <u8>((17 ^ 25) & 0xFF), `A = ${Cpu.A()}, expected ${(17 ^ 25) & 0xFF}`);
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunXorValue(25, 25); // XOR A, n8
    assert(Cpu.A() == 0, `A = ${Cpu.A()}, expected 0`);
    assert(Cpu.HasFlag(Flag.Z_Zero));

    return true;
}
