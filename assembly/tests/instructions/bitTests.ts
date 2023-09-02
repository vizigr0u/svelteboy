import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";

function RunBit(opCode: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assert(Cpu.CycleCount == expectedCycles + 4, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles + 4} (opcode 0x${opCode.toString(16)})`);
}

export function testBit(): boolean {
    RunBit(0x40, 42, Cpu.SetB); // BIT 0, B
    assert(Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.N_Sub));
    assert(Cpu.HasFlag(Flag.H_HalfC));

    RunBit(0x40, 41, Cpu.SetB); // BIT 0, B
    assert(!Cpu.HasFlag(Flag.Z_Zero));
    assert(!Cpu.HasFlag(Flag.N_Sub));
    assert(Cpu.HasFlag(Flag.H_HalfC));

    RunBit(0x44, 42, Cpu.SetH); // BIT 0, H
    assert(Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x4C, 0b1110, Cpu.SetH); // BIT 1, H
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x51, 0b110, Cpu.SetC); // BIT 2, C
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x55, 0b010, Cpu.SetL); // BIT 2, L
    assert(Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x5D, 0b0010, Cpu.SetL); // BIT 3, L
    assert(Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x62, 0b11000, Cpu.SetD); // BIT 4, D
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    // BIT 4, [HL]
    RunBit(0x66, 0b00111, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 12);
    assert(Cpu.HasFlag(Flag.Z_Zero));

    // BIT 5, [HL]
    RunBit(0x6E, 0b111111, v => { MemoryMap.GBstore(0x42, v); Cpu.HL = 0x42 }, 12);
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x73, 0b0011010, Cpu.SetE); // BIT 6, E
    assert(Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x77, 0b1110011, Cpu.SetA); // BIT 6, A
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    RunBit(0x7F, 0b10001000, Cpu.SetA); // BIT 7, A
    assert(!Cpu.HasFlag(Flag.Z_Zero));

    return true;
}
