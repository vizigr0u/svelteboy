import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../cpu/memoryMap";
import { PC, SP, setTestRom } from "../cpuTests";

function RunCall(opCode: u8, sp: u16, flags: u8, dest: u16, expectedCycles: u32): void {
    setTestRom([opCode]);
    Cpu.StackPointer = sp;
    MemoryMap.GBstore<u16>(0x1, dest);
    Cpu.SetF(flags);
    Cpu.Tick();
    MemoryMap.GBstore<u16>(0x1, 0);
    assert(Cpu.CycleCount == expectedCycles, `CycleCount = ${Cpu.CycleCount}, expected ${expectedCycles} (opcode 0x${opCode.toString(16)})`);
}

export function testCall(): boolean {
    let popped: u16;

    RunCall(0xC4, 0xFFFE, <u8>Flag.Z_Zero, 0x42FA, 12); // CALL NZ
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x3, `PC = ${PC().toString(16)}, expected 0x3`);

    RunCall(0xC4, 0xFFFE, <u8>Flag.C_Carry, 0x42FA, 24); // CALL NZ
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);
    popped = Cpu.PopSP();
    assert(popped == 0x3, `popped = ${popped}, expected 3`);

    RunCall(0xD4, 0xFFFE, <u8>Flag.C_Carry, 0x42FA, 12); // CALL NC
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x3, `PC = ${PC().toString(16)}, expected 0x3`);

    RunCall(0xD4, 0xFFFE, <u8>Flag.Z_Zero, 0x42FA, 24); // CALL NC
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);
    popped = Cpu.PopSP();
    assert(popped == 0x3, `popped = ${popped}, expected 3`);

    RunCall(0xCC, 0xFFFE, 0, 0x42FA, 12); // CALL Z
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x3, `PC = ${PC().toString(16)}, expected 0x3`);

    RunCall(0xCC, 0xFFFE, <u8>Flag.Z_Zero, 0x42FA, 24); // CALL Z
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);
    popped = Cpu.PopSP();
    assert(popped == 0x3, `popped = ${popped}, expected 3`);

    RunCall(0xDC, 0xFFFE, 0, 0x42FA, 12); // CALL C
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(Cpu.ProgramCounter == 0x3, `PC = ${PC().toString(16)}, expected 0x3`);

    RunCall(0xDC, 0xFFFE, <u8>Flag.C_Carry, 0x42FA, 24); // CALL C
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0x42FA, `PC = ${PC().toString(16)}, expected 0x42FA`);
    popped = Cpu.PopSP();
    assert(popped == 0x3, `popped = ${popped}, expected 3`);

    RunCall(0xCD, 0xFFFE, <u8>Flag.C_Carry, 0xBEEF, 24); // CALL
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(Cpu.ProgramCounter == 0xBEEF, `PC = ${PC().toString(16)}, expected 0xBEEF`);
    popped = Cpu.PopSP();
    assert(popped == 0x3, `popped = ${popped}, expected 3`);

    RunCall(0xCD, 0xFFF2, 0, 0xFA42, 24); // CALL
    assert(Cpu.StackPointer == 0xFFF0, `SP = ${SP().toString(16)}, expected 0xFFF0`);
    assert(Cpu.ProgramCounter == 0xFA42, `PC = ${PC().toString(16)}, expected 0xFA42`);
    popped = Cpu.PopSP();
    assert(popped == 0x3, `popped = ${popped}, expected 3`);

    return true;
}
