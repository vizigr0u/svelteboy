import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { PC, SP, setTestRom } from "../cpuTests";

function RunRet(opCode: u8, sp: u16, flags: u8, dest: u16, expectedCycles: u32): void {
    setTestRom([opCode]);
    Cpu.StackPointer = sp;
    MemoryMap.GBstore<u16>(sp, dest);
    Cpu.SetF(flags);
    Cpu.Tick();
    MemoryMap.GBstore<u16>(sp, 0);
    assert(Cpu.CycleCount == expectedCycles, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles} (opcode 0x${opCode.toString(16)})`);
}

export function testRet(): boolean {
    RunRet(0xC0, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 8); // RET NZ failed
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x1, `PC = ${PC().toString(16)}, expected 0x1`);

    RunRet(0xC0, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 20); // RET NZ
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);

    RunRet(0xD0, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 8); // RET NC failed
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x1, `PC = ${PC().toString(16)}, expected 0x1`);

    RunRet(0xD0, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 20); // RET NC
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);

    RunRet(0xC8, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 8); // RET Z failed
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x1, `PC = ${PC().toString(16)}, expected 0x1`);

    RunRet(0xC8, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 20); // RET Z
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);

    RunRet(0xD8, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 8); // RET C failed
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x1, `PC = ${PC().toString(16)}, expected 0x1`);

    RunRet(0xD8, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 20); // RET C
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);

    RunRet(0xC9, 0xFFFC, 0, 0x42FA, 16); // RET
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);

    RunRet(0xC9, 0xFFFC, <u8>(Flag.C_Carry | Flag.Z_Zero), 0x42FA, 16); // RET
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);

    return true;
}
