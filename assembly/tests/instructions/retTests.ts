import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { PC, SP, setTestRom } from "../cpuTests";
import { describe, it, assertEquals, assertCycles } from "../framework";

function RunRet(opCode: u8, sp: u16, flags: u8, dest: u16, expectedCycles: u32): void {
    setTestRom([opCode]);
    Cpu.StackPointer = sp;
    MemoryMap.GBstore<u16>(sp, dest);
    Cpu.SetF(flags);
    Cpu.Tick();
    MemoryMap.GBstore<u16>(sp, 0);
    assertCycles(expectedCycles);
}

export function testRet(): boolean {
    describe("RET", () => {
        it("RET NZ fail (Z set)", () => {
            RunRet(0xC0, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 8);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x1, "PC");
        });
        it("RET NZ taken", () => {
            RunRet(0xC0, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 20);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
        });
        it("RET NC fail (C set)", () => {
            RunRet(0xD0, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 8);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x1, "PC");
        });
        it("RET NC taken", () => {
            RunRet(0xD0, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 20);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
        });
        it("RET Z fail (Z clear)", () => {
            RunRet(0xC8, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 8);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x1, "PC");
        });
        it("RET Z taken", () => {
            RunRet(0xC8, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 20);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
        });
        it("RET C fail (C clear)", () => {
            RunRet(0xD8, 0xFFFC, <u8>Flag.Z_Zero, 0x42FA, 8);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x1, "PC");
        });
        it("RET C taken", () => {
            RunRet(0xD8, 0xFFFC, <u8>Flag.C_Carry, 0x42FA, 20);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
        });
        it("RET unconditional", () => {
            RunRet(0xC9, 0xFFFC, 0, 0x42FA, 16);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
        });
        it("RET unconditional with Z+C flags set", () => {
            RunRet(0xC9, 0xFFFC, <u8>(Flag.C_Carry | Flag.Z_Zero), 0x42FA, 16);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
        });
    });
    return true;
}
