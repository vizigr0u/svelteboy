import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles, assertMem } from "../framework";

function RunSet(opCode: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assertCycles(expectedCycles + 4);
}

export function testSet(): boolean {
    describe("SET", () => {
        it("SET 0,B 42 (bit already set)", () => {
            RunSet(0xC0, 42, Cpu.SetB);
            assertReg(Cpu.B(), 43, "B");
        });
        it("SET 0,B 41 (bit already set)", () => {
            RunSet(0xC0, 41, Cpu.SetB);
            assertReg(Cpu.B(), 41, "B");
        });
        it("SET 0,H 0", () => {
            RunSet(0xC4, 0, Cpu.SetH);
            assertReg(Cpu.H(), 1, "H");
        });
        it("SET 1,H 0b1101", () => {
            RunSet(0xCC, 0b1101, Cpu.SetH);
            assertReg(Cpu.H(), 0b1111, "H");
        });
        it("SET 2,C 0b10", () => {
            RunSet(0xD1, 0b10, Cpu.SetC);
            assertReg(Cpu.C(), 0b110, "C");
        });
        it("SET 2,L 0b10", () => {
            RunSet(0xD5, 0b10, Cpu.SetL);
            assertReg(Cpu.L(), 0b110, "L");
        });
        it("SET 3,L 0b0010", () => {
            RunSet(0xDD, 0b0010, Cpu.SetL);
            assertReg(Cpu.L(), 0b1010, "L");
        });
        it("SET 4,D 0b01000", () => {
            RunSet(0xE2, 0b01000, Cpu.SetD);
            assertReg(Cpu.D(), 0b11000, "D");
        });
        it("SET 4,[HL]", () => {
            RunSet(0xE6, 0b01000, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 16);
            assertMem(0xFF82, 0b11000);
            MemoryMap.GBstore(0xFF82, 0);
        });
        it("SET 5,[HL]", () => {
            RunSet(0xEE, 0b11111, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 16);
            assertMem(0xFF82, 0b111111);
            MemoryMap.GBstore(0xFF82, 0);
        });
        it("SET 6,E", () => {
            RunSet(0xF3, 0b0011010, Cpu.SetE);
            assertReg(Cpu.E(), 0b1011010, "E");
        });
        it("SET 6,A", () => {
            RunSet(0xF7, 0b0011010, Cpu.SetA);
            assertReg(Cpu.A(), 0b1011010, "A");
        });
        it("SET 7,A", () => {
            RunSet(0xFF, 0b01001010, Cpu.SetA);
            assertReg(Cpu.A(), 0b11001010, "A");
        });
    });
    return true;
}
