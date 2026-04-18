import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { BC, DE, HL, SP, SetBC, SetDE, SetHL, SetSP, setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles, assertMem, assertEquals } from "../framework";

function RunDec(opCode: u8, a: u8, setA: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assertCycles(expectedCycles);
    assert(Cpu.FlagN());
}

function RunDec16(opCode: u8, a: u16, setA: (a: u16) => void): void {
    setTestRom([opCode]);
    setA(a);
    Cpu.Tick();
    assertCycles(8);
}

export function testDec(): boolean {
    describe("DEC", () => {
        it("DEC BC 43→42", () => {
            RunDec16(0x0B, 43, SetBC);
            assertEquals<u16>(BC(), 42, "BC");
        });
        it("DEC BC preserves C,N flags", () => {
            const testFlag: u8 = <u8>(Flag.C_Carry | Flag.N_Sub);
            RunDec16(0x0B, 43, v => { SetBC(v); Cpu.SetF(testFlag) });
            assertEquals<u16>(BC(), 42, "BC");
            assertEquals<u8>(Cpu.F(), testFlag, "F");
        });
        it("DEC BC wraps 0→0xFFFF", () => {
            const testFlag: u8 = <u8>(Flag.C_Carry | Flag.N_Sub);
            RunDec16(0x0B, 0, v => { SetBC(v); Cpu.SetF(testFlag) });
            assertEquals<u16>(BC(), 0xFFFF, "BC");
            assertEquals<u8>(Cpu.F(), testFlag, "F");
        });
        it("DEC DE 43→42", () => {
            RunDec16(0x1B, 43, SetDE);
            assertEquals<u16>(DE(), 42, "DE");
        });
        it("DEC HL 43→42", () => {
            RunDec16(0x2B, 43, SetHL);
            assertEquals<u16>(HL(), 42, "HL");
        });
        it("DEC SP 43→42", () => {
            RunDec16(0x3B, 43, SetSP);
            assertEquals<u16>(SP(), 42, "SP");
        });
        it("DEC [HL] 17→16", () => {
            RunDec(0x35, 17, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 12);
            assertMem(0xFF82, 16);
            MemoryMap.GBstore(0xFF82, 0);
        });
        it("DEC B 43→42", () => {
            RunDec(0x05, 43, Cpu.SetB);
            assertReg(Cpu.B(), 42, "B");
        });
        it("DEC C 43→42", () => {
            RunDec(0x0D, 43, Cpu.SetC);
            assertReg(Cpu.C(), 42, "C");
        });
        it("DEC D 43→42", () => {
            RunDec(0x15, 43, Cpu.SetD);
            assertReg(Cpu.D(), 42, "D");
        });
        it("DEC D 43→42 non-zero", () => {
            RunDec(0x15, 43, Cpu.SetD);
            assertReg(Cpu.D(), 42, "D");
            assert(!Cpu.FlagZ());
        });
        it("DEC D 1→0 (zero, no half-carry)", () => {
            RunDec(0x15, 1, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.N_Sub) });
            assertReg(Cpu.D(), 0, "D");
            assert(Cpu.FlagZ());
            assert(!Cpu.FlagH());
        });
        it("DEC D 0→0xFF (half-carry, wrap)", () => {
            RunDec(0x15, 0, Cpu.SetD);
            assertReg(Cpu.D(), 0xFF, "D");
            assert(!Cpu.FlagZ());
            assert(Cpu.FlagH(), 'HalfCarry flag not set');
        });
        it("DEC D 0x10→0xF (half-carry)", () => {
            RunDec(0x15, 0x10, Cpu.SetD);
            assertReg(Cpu.D(), 0xF, "D");
            assert(!Cpu.FlagZ());
            assert(Cpu.FlagH(), 'HalfCarry flag set');
        });
        it("DEC E 43→42", () => {
            RunDec(0x1D, 43, Cpu.SetE);
            assertReg(Cpu.E(), 42, "E");
        });
        it("DEC H 43→42", () => {
            RunDec(0x25, 43, Cpu.SetH);
            assertReg(Cpu.H(), 42, "H");
        });
        it("DEC L 43→42", () => {
            RunDec(0x2D, 43, Cpu.SetL);
            assertReg(Cpu.L(), 42, "L");
        });
        it("DEC A 43→42", () => {
            RunDec(0x3D, 43, Cpu.SetA);
            assertReg(Cpu.A(), 42, "A");
        });
    });
    return true;
}
