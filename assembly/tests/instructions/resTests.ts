import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../cpu/memoryMap";
import { setTestRom } from "../cpuTests";

function RunRes(opCode: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assert(Cpu.CycleCount == expectedCycles + 4, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles} (opcode 0x${opCode.toString(16)})`);
}

export function testRes(): boolean {
    RunRes(0x80, 42, Cpu.SetB); // RES 0, B
    assert(Cpu.B() == 42);

    RunRes(0x80, 43, Cpu.SetB); // RES 0, B
    assert(Cpu.B() == 42);

    RunRes(0x84, 1, Cpu.SetH); // RES 0, H
    assert(Cpu.H() == 0);

    RunRes(0x8C, 0b1110, Cpu.SetH); // RES 1, H
    assert(Cpu.H() == 0b1100);

    RunRes(0x91, 0b110, Cpu.SetC); // RES 2, C
    assert(Cpu.C() == 0b10);

    RunRes(0x95, 0b110, Cpu.SetL); // RES 2, L
    assert(Cpu.L() == 0b10);

    RunRes(0x9D, 0b1010, Cpu.SetL); // RES 3, L
    assert(Cpu.L() == 0b0010);

    RunRes(0xA2, 0b11000, Cpu.SetD); // RES 4, D
    assert(Cpu.D() == 0b01000);

    // RES 4, [HL]
    RunRes(0xA6, 0b11000, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 16);
    assert(MemoryMap.GBload<u8>(0x42) == 0b01000);
    MemoryMap.GBstore(0x42, 0);

    // RES 5, [HL]
    RunRes(0xAE, 0b111111, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 16);
    assert(MemoryMap.GBload<u8>(0x42) == 0b11111);
    MemoryMap.GBstore(0x42, 0);

    RunRes(0xB3, 0b1011010, Cpu.SetE); // RES 6, E
    assert(Cpu.E() == 0b0011010);

    RunRes(0xB7, 0b1011010, Cpu.SetA); // RES 6, A
    assert(Cpu.A() == 0b0011010);

    RunRes(0xBF, 0b11001010, Cpu.SetA); // RES 7, A
    assert(Cpu.A() == 0b01001010);

    return true;
}
