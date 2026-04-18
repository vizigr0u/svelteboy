import { Cpu, Flag } from "../../cpu/cpu";
import { PC, SP, setTestRom } from "../cpuTests";
import { describe, it, assertEquals, assertCycles } from "../framework";

function RunCall(opCode: u8, sp: u16, flags: u8, dest: u16, expectedCycles: u32): void {
    setTestRom([opCode, <u8>(dest & 0xFF), <u8>(dest >> 8)]);
    Cpu.StackPointer = sp;
    Cpu.SetF(flags);
    Cpu.Tick();
    assertCycles(expectedCycles);
}

export function testCall(): boolean {
    describe("CALL", () => {
        it("CALL NZ fail (Z set)", () => {
            RunCall(0xC4, 0xFFFE, <u8>Flag.Z_Zero, 0x42FA, 12);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });
        it("CALL NZ taken", () => {
            RunCall(0xC4, 0xFFFE, <u8>Flag.C_Carry, 0x42FA, 24);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
            assertEquals<u16>(Cpu.PopSP(), 0x3, "popped");
        });
        it("CALL NC fail (C set)", () => {
            RunCall(0xD4, 0xFFFE, <u8>Flag.C_Carry, 0x42FA, 12);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });
        it("CALL NC taken", () => {
            RunCall(0xD4, 0xFFFE, <u8>Flag.Z_Zero, 0x42FA, 24);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
            assertEquals<u16>(Cpu.PopSP(), 0x3, "popped");
        });
        it("CALL Z fail (Z clear)", () => {
            RunCall(0xCC, 0xFFFE, 0, 0x42FA, 12);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });
        it("CALL Z taken", () => {
            RunCall(0xCC, 0xFFFE, <u8>Flag.Z_Zero, 0x42FA, 24);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
            assertEquals<u16>(Cpu.PopSP(), 0x3, "popped");
        });
        it("CALL C fail (C clear)", () => {
            RunCall(0xDC, 0xFFFE, 0, 0x42FA, 12);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x3, "PC");
        });
        it("CALL C taken", () => {
            RunCall(0xDC, 0xFFFE, <u8>Flag.C_Carry, 0x42FA, 24);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0x42FA, "PC");
            assertEquals<u16>(Cpu.PopSP(), 0x3, "popped");
        });
        it("CALL unconditional to 0xBEEF", () => {
            RunCall(0xCD, 0xFFFE, <u8>Flag.C_Carry, 0xBEEF, 24);
            assertEquals<u16>(Cpu.StackPointer, 0xFFFC, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0xBEEF, "PC");
            assertEquals<u16>(Cpu.PopSP(), 0x3, "popped");
        });
        it("CALL unconditional to 0xFA42", () => {
            RunCall(0xCD, 0xFFF2, 0, 0xFA42, 24);
            assertEquals<u16>(Cpu.StackPointer, 0xFFF0, "SP");
            assertEquals<u16>(Cpu.ProgramCounter, 0xFA42, "PC");
            assertEquals<u16>(Cpu.PopSP(), 0x3, "popped");
        });
    });
    return true;
}
