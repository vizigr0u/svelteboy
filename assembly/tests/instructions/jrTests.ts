import { Cpu, Flag } from "../../cpu"
import { BOOT_ROM_START, MemoryMap } from "../../memoryMap";
import { PC, SP, setTestRom } from "../cpuTests";

function RunJr(opCode: u8, offset: u8, flags: u8, expectedCycles: u32 = 12): void {
    setTestRom([opCode, offset]);
    Cpu.SetF(flags);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles} (opcode 0x${opCode.toString(16)})`);
}

function RunJrNeg(opCode: u8, startPc: u16, offset: u8, flags: u8, expectedCycles: u32 = 12): void {
    setTestRom([opCode, offset]); // call anyway for opcode census
    const instructions: Array<u8> = new Array<u8>(startPc + 2);
    instructions.fill(0);
    instructions[startPc] = opCode;
    instructions[startPc + 1] = offset;
    memory.copy(BOOT_ROM_START, instructions.dataStart, instructions.length);
    MemoryMap.loadedBootRomSize = instructions.length;
    Cpu.SetF(flags);
    Cpu.ProgramCounter = startPc;
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles} (opcode 0x${opCode.toString(16)})`);
}

export function testJr(): boolean {
    RunJr(0x20, 2, <u8>Flag.Z_Zero, 8); // JR NZ fail
    assert(Cpu.ProgramCounter == 0x2, `PC = ${PC().toString(16)}, expected 0x2`);

    RunJr(0x20, 0x8, <u8>Flag.C_Carry); // JR NZ
    assert(Cpu.ProgramCounter == 0x2 + 0x8, `PC = ${PC().toString(16)}, expected 0x8`);

    RunJrNeg(0x20, 0x30, <u8>(-0x10), <u8>Flag.C_Carry); // JR NZ
    assert(Cpu.ProgramCounter == 0x2 + 0x30 - 0x10, `PC = ${PC().toString(16)}, expected 0x20`);

    RunJr(0x30, 2, <u8>Flag.C_Carry, 8); // JR NC fail
    assert(Cpu.ProgramCounter == 0x2, `PC = ${PC().toString(16)}, expected 0x2`);

    RunJr(0x30, 0x8, <u8>Flag.Z_Zero); // JR NC
    assert(Cpu.ProgramCounter == 0x2 + 0x8, `PC = ${PC().toString(16)}, expected 0x8`);

    RunJr(0x28, 2, <u8>Flag.C_Carry, 8); // JR Z fail
    assert(Cpu.ProgramCounter == 0x2, `PC = ${PC().toString(16)}, expected 0x2`);

    RunJr(0x28, 0x8, <u8>Flag.Z_Zero); // JR Z
    assert(Cpu.ProgramCounter == 0x2 + 0x8, `PC = ${PC().toString(16)}, expected 0x8`);

    RunJr(0x38, 2, <u8>Flag.Z_Zero, 8); // JR C fail
    assert(Cpu.ProgramCounter == 0x2, `PC = ${PC().toString(16)}, expected 0x2`);

    RunJr(0x38, 0x8, <u8>Flag.C_Carry); // JR C
    assert(Cpu.ProgramCounter == 0x2 + 0x8, `PC = ${PC().toString(16)}, expected 0x8`);

    RunJr(0x18, 0x8, 0); // JR e8
    assert(Cpu.ProgramCounter == 0x2 + 0x8, `PC = ${PC().toString(16)}, expected 0x8`);

    return true;
}
