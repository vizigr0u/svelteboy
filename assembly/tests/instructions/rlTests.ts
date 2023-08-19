import { ClearHLDerefTest, HLDeref, SetHLDeref } from ".";
import { Cpu, Flag } from "../../cpu/cpu";
import { setTestRom } from "../cpuTests";

function RunRl(opCode: u8, carry: bool, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.SetFlag(Flag.C_Carry, carry);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assert(Cpu.CycleCount == expectedCycles + 4, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles + 4} (opcode 0x${opCode.toString(16)})`);
}

export function testRl(): boolean {
    RunRl(0x10, 0, 0b10101110, Cpu.SetB); // RL B
    assert(Cpu.B() == 0b01011100, `B = 0b${Cpu.B().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRl(0x10, 1, 0b10101110, Cpu.SetB); // RL B
    assert(Cpu.B() == 0b01011101, `B = 0b${Cpu.B().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRl(0x11, 1, 0b10101110, Cpu.SetC); // RL C
    assert(Cpu.C() == 0b01011101, `C = 0b${Cpu.C().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRl(0x12, 1, 0b00101110, Cpu.SetD); // RL D
    assert(Cpu.D() == 0b01011101, `D = 0b${Cpu.D().toString(2)}, expected 0b01011100`);
    assert(!Cpu.HasFlag(Flag.C_Carry), `expected non Carry`);

    RunRl(0x13, 1, 0b10101110, Cpu.SetE); // RL E
    assert(Cpu.E() == 0b01011101, `E = 0b${Cpu.E().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRl(0x14, 1, 0b10101110, Cpu.SetH); // RL H
    assert(Cpu.H() == 0b01011101, `H = 0b${Cpu.H().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRl(0x15, 1, 0b10101110, Cpu.SetL); // RL L
    assert(Cpu.L() == 0b01011101, `L = 0b${Cpu.L().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRl(0x16, 1, 0b10101110, SetHLDeref, 16); // RL [HL]
    assert(HLDeref() == 0b01011101, `[HL] = 0b${HLDeref().toString(2)}, expected 0b10011101`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);

    RunRl(0x17, 0, 0b10101110, Cpu.SetA); // RL A
    assert(Cpu.A() == 0b01011100, `A = 0b${Cpu.A().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);
    assert(!Cpu.HasFlag(Flag.Z_Zero), `expected Non zero`);

    RunRl(0x17, 0, 0b10000000, Cpu.SetA); // RL A
    assert(Cpu.A() == 0b00000000, `A = 0b${Cpu.A().toString(2)}, expected 0b01011100`);
    assert(Cpu.HasFlag(Flag.C_Carry), `expected Carry`);
    assert(Cpu.HasFlag(Flag.Z_Zero), `expected zero`);

    ClearHLDerefTest();

    return true;
}
