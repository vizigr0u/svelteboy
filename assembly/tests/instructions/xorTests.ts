import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles, assertFlags } from "../framework";

function RunXor(opCode: u8, a: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    Cpu.SetA(a);
    setB(b);
    Cpu.Tick();
    assertCycles(expectedCycles);
}

function RunXorValue(a: u8, b: u8): void {
    setTestRom([0xEE, b]);
    Cpu.SetA(a);
    Cpu.Tick();
    assertCycles(8);
}

export function testXor(): boolean {
    describe("XOR", () => {
        it("XOR A,B non-zero", () => {
            RunXor(0xA8, 17, 25, Cpu.SetB);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
            assertFlags(false, false, false, false);
        });
        it("XOR A,B zero", () => {
            RunXor(0xA8, 42, 42, Cpu.SetB);
            assertReg(Cpu.A(), 0, "A");
            assertFlags(true, false, false, false);
        });
        it("XOR A,C", () => {
            RunXor(0xA9, 17, 25, Cpu.SetC);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
        });
        it("XOR A,D", () => {
            RunXor(0xAA, 17, 25, Cpu.SetD);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
        });
        it("XOR A,E", () => {
            RunXor(0xAB, 17, 25, Cpu.SetE);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
        });
        it("XOR A,H", () => {
            RunXor(0xAC, 17, 25, Cpu.SetH);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
        });
        it("XOR A,L", () => {
            RunXor(0xAD, 17, 25, Cpu.SetL);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
        });
        it("XOR A,[HL]", () => {
            RunXor(0xAE, 17, 25, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 8);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
            MemoryMap.GBstore(0xFF82, 0);
        });
        it("XOR A,A (self-zero)", () => {
            RunXor(0xAF, 17, 25, Cpu.SetB);
            assertReg(Cpu.A(), 0, "A");
            assertFlags(true, false, false, false);
        });
        it("XOR A,n8 non-zero", () => {
            RunXorValue(17, 25);
            assertReg(Cpu.A(), <u8>((17 ^ 25) & 0xFF), "A");
            assertFlags(false, false, false, false);
        });
        it("XOR A,n8 zero", () => {
            RunXorValue(25, 25);
            assertReg(Cpu.A(), 0, "A");
            assertFlags(true, false, false, false);
        });
    });
    return true;
}
