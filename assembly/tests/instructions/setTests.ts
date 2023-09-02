import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";

function RunSet(opCode: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assert(Cpu.CycleCount == expectedCycles + 4, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles} (opcode 0x${opCode.toString(16)})`);
}

export function testSet(): boolean {
    RunSet(0xC0, 42, Cpu.SetB); // SET 0, B
    assert(Cpu.B() == 43);

    RunSet(0xC0, 41, Cpu.SetB); // SET 0, B
    assert(Cpu.B() == 41);

    RunSet(0xC4, 0, Cpu.SetH); // SET 0, H
    assert(Cpu.H() == 1);

    RunSet(0xCC, 0b1101, Cpu.SetH); // SET 1, H
    assert(Cpu.H() == 0b1111);

    RunSet(0xD1, 0b10, Cpu.SetC); // SET 2, C
    assert(Cpu.C() == 0b110);

    RunSet(0xD5, 0b10, Cpu.SetL); // SET 2, L
    assert(Cpu.L() == 0b110);

    RunSet(0xDD, 0b0010, Cpu.SetL); // SET 3, L
    assert(Cpu.L() == 0b1010);

    RunSet(0xE2, 0b01000, Cpu.SetD); // SET 4, D
    assert(Cpu.D() == 0b11000);

    // SET 4, [HL]
    RunSet(0xE6, 0b01000, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 16);
    assert(MemoryMap.GBload<u8>(0x42) == 0b11000);
    MemoryMap.GBstore(0x42, 0);

    // SET 5, [HL]
    RunSet(0xEE, 0b11111, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 16);
    assert(MemoryMap.GBload<u8>(0x42) == 0b111111);
    MemoryMap.GBstore(0x42, 0);

    RunSet(0xF3, 0b0011010, Cpu.SetE); // SET 6, E
    assert(Cpu.E() == 0b1011010);

    RunSet(0xF7, 0b0011010, Cpu.SetA); // SET 6, A
    assert(Cpu.A() == 0b1011010);

    RunSet(0xFF, 0b01001010, Cpu.SetA); // SET 7, A
    assert(Cpu.A() == 0b11001010);

    return true;
}
