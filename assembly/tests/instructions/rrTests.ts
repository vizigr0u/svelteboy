import { ClearHLDerefTest, HLDeref, SetHLDeref } from ".";
import { Cpu, Flag } from "../../cpu"
import { HL, setTestRom } from "../cpuTests";

function RunRr(opCode: u8, carry: bool, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.SetFlag(Flag.C_Carry, carry);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assert(Cpu.CycleCount == expectedCycles + 4, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles + 4} (opcode 0x${opCode.toString(16)})`);
}

export function testRr(): boolean {
    RunRr(0x18, 0, 0b10101111, Cpu.SetB); // RR B
    assert(Cpu.B() == 0b1010111, `B = 0b${Cpu.B().toString(2)}, expected 0b1010111`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRr(0x18, 1, 0b10101111, Cpu.SetB); // RR B
    assert(Cpu.B() == 0b11010111, `B = 0b${Cpu.B().toString(2)}, expected 0b11010111`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRr(0x19, 1, 0b10101111, Cpu.SetC); // RR C
    assert(Cpu.C() == 0b11010111, `C = 0b${Cpu.C().toString(2)}, expected 0b11010111`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRr(0x1A, 1, 0b00101110, Cpu.SetD); // RR D
    assert(Cpu.D() == 0b10010111, `D = 0b${Cpu.D().toString(2)}, expected 0b10010111`);
    assert(!Cpu.HasFlag(Flag.C_Carry), `expected non Carry`);

    RunRr(0x1B, 1, 0b10101111, Cpu.SetE); // RR E
    assert(Cpu.E() == 0b11010111, `E = 0b${Cpu.E().toString(2)}, expected 0b11010111`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRr(0x1C, 1, 0b10101111, Cpu.SetH); // RR H
    assert(Cpu.H() == 0b11010111, `H = 0b${Cpu.H().toString(2)}, expected 0b11010111`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRr(0x1D, 1, 0b10101111, Cpu.SetL); // RR L
    assert(Cpu.L() == 0b11010111, `L = 0b${Cpu.L().toString(2)}, expected 0b11010111`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRr(0x1E, 1, 0b10101111, SetHLDeref, 16); // RR [HL]
    assert(HLDeref() == 0b11010111, `[HL] = 0b${HLDeref().toString(2)}, expected 10011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRr(0x1F, 0, 0b10101111, Cpu.SetA); // RR A
    assert(Cpu.A() == 0b1010111, `A = 0b${Cpu.A().toString(2)}, expected 0b1010111`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);
    assert(!Cpu.HasFlag(Flag.Z_Zero), `expected Non zero`);

    RunRr(0x1F, 0, 0b00000001, Cpu.SetA); // RR A
    assert(Cpu.A() == 0b00000000, `A = 0b${Cpu.A().toString(2)}, expected 0b00000000`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);
    assert(Cpu.HasFlag(Flag.Z_Zero), `expected zero`);

    ClearHLDerefTest();

    return true;
}
