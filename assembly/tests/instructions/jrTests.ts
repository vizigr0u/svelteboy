import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { BOOT_ROM_START } from "../../memory/memoryConstants";
import { PC, setTestRom } from "../cpuTests";
import { describe, it, assertEquals, assertCycles } from "../framework";

function RunJr(opCode: u8, offset: u8, flags: u8, expectedCycles: u32 = 12): void {
    setTestRom([opCode, offset]);
    Cpu.SetF(flags);
    Cpu.Tick();
    assertCycles(expectedCycles);
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
    assertCycles(expectedCycles);
}

export function testJr(): boolean {
    describe("JR", () => {
        it("JR NZ fail (Z set)", () => {
            RunJr(0x20, 2, <u8>Flag.Z_Zero, 8);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2, "PC");
        });
        it("JR NZ taken", () => {
            RunJr(0x20, 0x8, <u8>Flag.C_Carry);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2 + 0x8, "PC");
        });
        it("JR NZ taken (negative offset)", () => {
            RunJrNeg(0x20, 0x30, <u8>(-0x10), <u8>Flag.C_Carry);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2 + 0x30 - 0x10, "PC");
        });
        it("JR NC fail (C set)", () => {
            RunJr(0x30, 2, <u8>Flag.C_Carry, 8);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2, "PC");
        });
        it("JR NC taken", () => {
            RunJr(0x30, 0x8, <u8>Flag.Z_Zero);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2 + 0x8, "PC");
        });
        it("JR Z fail (Z clear)", () => {
            RunJr(0x28, 2, <u8>Flag.C_Carry, 8);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2, "PC");
        });
        it("JR Z taken", () => {
            RunJr(0x28, 0x8, <u8>Flag.Z_Zero);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2 + 0x8, "PC");
        });
        it("JR C fail (C clear)", () => {
            RunJr(0x38, 2, <u8>Flag.Z_Zero, 8);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2, "PC");
        });
        it("JR C taken", () => {
            RunJr(0x38, 0x8, <u8>Flag.C_Carry);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2 + 0x8, "PC");
        });
        it("JR e8 (unconditional)", () => {
            RunJr(0x18, 0x8, 0);
            assertEquals<u16>(Cpu.ProgramCounter, 0x2 + 0x8, "PC");
        });
    });
    return true;
}
