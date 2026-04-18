import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles } from "../framework";

function RunSub(opCode: u8, a: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    Cpu.SetA(a);
    setB(b);
    Cpu.Tick();
    assertCycles(expectedCycles);
    assert(Cpu.FlagN());
}

function RunSubValue(a: u8, b: u8): void {
    setTestRom([0xd6, b]);
    Cpu.SetA(a);
    Cpu.Tick();
    assertCycles(8);
    assert(Cpu.FlagN());
}

export function testSub(): boolean {
    describe("SUB", () => {
        it("SUB A,[HL] 53-11=42", () => {
            const addr: u16 = 0xFF82;
            RunSub(0x96, 53, 11, v => { MemoryMap.GBstore(addr, v); Cpu.HL = addr }, 8);
            assertReg(Cpu.A(), 42, "A");
            MemoryMap.GBstore(addr, 0);
        });
        it("SUB A,B 53-11=42", () => {
            RunSub(0x90, 53, 11, Cpu.SetB);
            assertReg(Cpu.A(), 42, "A");
        });
        it("SUB A,C 53-11=42", () => {
            RunSub(0x91, 53, 11, Cpu.SetC);
            assertReg(Cpu.A(), 42, "A");
        });
        it("SUB A,D 53-11=42", () => {
            RunSub(0x92, 53, 11, Cpu.SetD);
            assertReg(Cpu.A(), 42, "A");
        });
        it("SUB A,D 53-11=42 non-zero", () => {
            RunSub(0x92, 53, 11, Cpu.SetD);
            assertReg(Cpu.A(), 42, "A");
            assert(!Cpu.FlagZ());
        });
        it("SUB A,D 53-53=0 (zero, no half-carry)", () => {
            RunSub(0x92, 53, 53, v => { Cpu.SetD(v); Cpu.SetFlag(Flag.N_Sub) });
            assertReg(Cpu.A(), 0, "A");
            assert(Cpu.FlagZ());
            assert(!Cpu.FlagH());
        });
        it("SUB A,D 0xF2-3=0xEF (half-carry)", () => {
            RunSub(0x92, 0xF2, 3, Cpu.SetD);
            assertReg(Cpu.A(), 0xEF, "A");
            assert(!Cpu.FlagZ());
            assert(Cpu.FlagH(), 'HalfCarry flag not set');
        });
        it("SUB A,D 0xF5-3=0xF2 (no half-carry)", () => {
            RunSub(0x92, 0xF5, 3, Cpu.SetD);
            assertReg(Cpu.A(), 0xF2, "A");
            assert(!Cpu.FlagZ());
            assert(!Cpu.FlagH(), 'HalfCarry flag set');
        });
        it("SUB A,E 53-11=42", () => {
            RunSub(0x93, 53, 11, Cpu.SetE);
            assertReg(Cpu.A(), 42, "A");
        });
        it("SUB A,H 53-11=42", () => {
            RunSub(0x94, 53, 11, Cpu.SetH);
            assertReg(Cpu.A(), 42, "A");
        });
        it("SUB A,L 53-11=42", () => {
            RunSub(0x95, 53, 11, Cpu.SetL);
            assertReg(Cpu.A(), 42, "A");
        });
        it("SUB A,A 53-42=0", () => {
            RunSub(0x97, 53, 42, Cpu.SetA);
            assertReg(Cpu.A(), 0, "A");
        });
        it("SUB A,n8 53-11=42", () => {
            RunSubValue(53, 11);
            assertReg(Cpu.A(), 42, "A");
        });
        it("SUB A,n8 41-0xFF=42 (wrap)", () => {
            RunSubValue(41, 0xFF);
            assertReg(Cpu.A(), 42, "A");
        });
    });
    return true;
}
