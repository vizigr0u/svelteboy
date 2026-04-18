import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";

function RunCp(opCode: u8, a: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    Cpu.SetA(a);
    setB(b);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
    assert(Cpu.FlagN());
}

function RunCpValue(opCode: u8, a: u8, b: u8): void {
    setTestRom([opCode, b]);
    Cpu.SetA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == 8);
    assert(Cpu.FlagN());
}


export function testCp(): boolean {
    RunCp(0xB8, 22, 24, Cpu.SetB); // CP A, B
    assert(!Cpu.FlagZ());
    assert(Cpu.FlagH());
    assert(Cpu.FlagC());

    RunCp(0xB9, 42, 42, Cpu.SetC); // CP A, C
    assert(Cpu.FlagZ());
    assert(!Cpu.FlagH());
    assert(!Cpu.FlagC());

    RunCp(0xBA, 22, 24, Cpu.SetD); // CP A, D
    assert(!Cpu.FlagZ());
    assert(Cpu.FlagH());
    assert(Cpu.FlagC());

    RunCp(0xBB, 0xFA, 0x12, Cpu.SetE); // CP A, E
    assert(!Cpu.FlagZ());
    assert(!Cpu.FlagH());
    assert(!Cpu.FlagC());

    RunCp(0xBC, 22, 24, Cpu.SetH); // CP A, H
    assert(!Cpu.FlagZ());
    assert(Cpu.FlagH());
    assert(Cpu.FlagC());

    RunCp(0xBD, 22, 24, Cpu.SetL); // CP A, L
    assert(!Cpu.FlagZ());
    assert(Cpu.FlagH());
    assert(Cpu.FlagC());

    RunCp(0xBF, 42, 0xFE, Cpu.SetA); // CP A, A
    assert(Cpu.FlagZ());
    assert(!Cpu.FlagH());
    assert(!Cpu.FlagC());

    RunCp(0xBE, 22, 25, v => { MemoryMap.GBstore<u8>(0xFF82, v); Cpu.HL = 0xFF82 }, 8); // CP A, [HL]
    assert(!Cpu.FlagZ());
    assert(Cpu.FlagH());
    assert(Cpu.FlagC());

    RunCp(0xBE, 42, 42, v => { MemoryMap.GBstore<u8>(0xFF82, v); Cpu.HL = 0xFF82 }, 8); // CP A, [HL]
    assert(Cpu.FlagZ());
    assert(!Cpu.FlagH());
    assert(!Cpu.FlagC());

    // CP A, n8
    RunCpValue(0xFE, 22, 25); // CP A, n8
    assert(!Cpu.FlagZ());
    assert(Cpu.FlagH());
    assert(Cpu.FlagC());

    return true;
}
