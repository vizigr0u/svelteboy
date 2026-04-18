import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { BC, DE, HL, SP, SetBC, SetDE, SetHL, SetSP, setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles, assertMem, assertEquals } from "../framework";

function RunInc(opCode: u8, a: u8, setA: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assertCycles(expectedCycles);
}

function RunInc16(opCode: u8, a: u16, setA: (a: u16) => void): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assertCycles(8);
}

export function testInc(): boolean {
    describe("INC", () => {
        it("INC BC 41→42", () => {
            RunInc16(0x03, 41, SetBC);
            assertEquals<u16>(BC(), 42, "BC");
        });
        it("INC BC preserves C,N flags", () => {
            const testFlag: u8 = <u8>(Flag.C_Carry | Flag.N_Sub);
            RunInc16(0x03, 41, v => { SetBC(v); Cpu.SetF(testFlag) });
            assertEquals<u16>(BC(), 42, "BC");
            assertEquals<u8>(Cpu.F(), testFlag, "F");
        });
        it("INC BC wraps 0xFFFF→0", () => {
            const testFlag: u8 = <u8>(Flag.C_Carry | Flag.N_Sub);
            RunInc16(0x03, 0xFFFF, v => { SetBC(v); Cpu.SetF(testFlag) });
            assertEquals<u16>(BC(), 0, "BC");
            assertEquals<u8>(Cpu.F(), testFlag, "F");
        });
        it("INC DE 41→42", () => {
            RunInc16(0x13, 41, SetDE);
            assertEquals<u16>(DE(), 42, "DE");
        });
        it("INC HL 41→42", () => {
            RunInc16(0x23, 41, SetHL);
            assertEquals<u16>(HL(), 42, "HL");
        });
        it("INC SP 41→42", () => {
            RunInc16(0x33, 41, SetSP);
            assertEquals<u16>(SP(), 42, "SP");
        });
        it("INC [HL] 17→18", () => {
            RunInc(0x34, 17, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 12);
            assertMem(0xFF82, 18);
            MemoryMap.GBstore(0xFF82, 0);
        });
        it("INC B 41→42", () => {
            RunInc(0x04, 41, Cpu.SetB);
            assertReg(Cpu.B(), 42, "B");
        });
        it("INC C 41→42", () => {
            RunInc(0x0C, 41, Cpu.SetC);
            assertReg(Cpu.C(), 42, "C");
        });
        it("INC D 41→42", () => {
            RunInc(0x14, 41, Cpu.SetD);
            assertReg(Cpu.D(), 42, "D");
        });
        it("INC D 41→42 non-zero", () => {
            RunInc(0x14, 41, Cpu.SetD);
            assertReg(Cpu.D(), 42, "D");
            assert(!Cpu.FlagZ());
        });
        it("INC D clears N, preserves C", () => {
            RunInc(0x14, 41, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.N_Sub) });
            assertReg(Cpu.D(), 42, "D");
            assert(!Cpu.FlagN());
            assert(!Cpu.FlagH());
            assert(Cpu.FlagC());
        });
        it("INC D 0xFF→0 (zero, half-carry, no carry change)", () => {
            RunInc(0x14, 0xFF, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.C_Carry, false); });
            assertReg(Cpu.D(), 0, "D");
            assert(Cpu.FlagZ());
            assert(Cpu.FlagH());
            assert(!Cpu.FlagC());
        });
        it("INC D 0xF→0x10 (half-carry)", () => {
            RunInc(0x14, 0xF, Cpu.SetD);
            assertReg(Cpu.D(), 0x10, "D");
            assert(Cpu.FlagH(), 'HalfCarry flag not set');
        });
        it("INC E 41→42", () => {
            RunInc(0x1C, 41, Cpu.SetE);
            assertReg(Cpu.E(), 42, "E");
        });
        it("INC H 41→42", () => {
            RunInc(0x24, 41, Cpu.SetH);
            assertReg(Cpu.H(), 42, "H");
        });
        it("INC L 41→42", () => {
            RunInc(0x2C, 41, Cpu.SetL);
            assertReg(Cpu.L(), 42, "L");
        });
        it("INC A 41→42", () => {
            RunInc(0x3C, 41, Cpu.SetA);
            assertReg(Cpu.A(), 42, "A");
        });
    });
    return true;
}
