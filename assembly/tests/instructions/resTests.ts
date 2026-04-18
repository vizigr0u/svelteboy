import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles, assertMem } from "../framework";

function RunRes(opCode: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assertCycles(expectedCycles + 4);
}

export function testRes(): boolean {
    describe("RES", () => {
        it("RES 0,B 42 (bit already clear)", () => {
            RunRes(0x80, 42, Cpu.SetB);
            assertReg(Cpu.B(), 42, "B");
        });
        it("RES 0,B 43 (clears bit 0)", () => {
            RunRes(0x80, 43, Cpu.SetB);
            assertReg(Cpu.B(), 42, "B");
        });
        it("RES 0,H 1", () => {
            RunRes(0x84, 1, Cpu.SetH);
            assertReg(Cpu.H(), 0, "H");
        });
        it("RES 1,H 0b1110", () => {
            RunRes(0x8C, 0b1110, Cpu.SetH);
            assertReg(Cpu.H(), 0b1100, "H");
        });
        it("RES 2,C 0b110", () => {
            RunRes(0x91, 0b110, Cpu.SetC);
            assertReg(Cpu.C(), 0b10, "C");
        });
        it("RES 2,L 0b110", () => {
            RunRes(0x95, 0b110, Cpu.SetL);
            assertReg(Cpu.L(), 0b10, "L");
        });
        it("RES 3,L 0b1010", () => {
            RunRes(0x9D, 0b1010, Cpu.SetL);
            assertReg(Cpu.L(), 0b0010, "L");
        });
        it("RES 4,D 0b11000", () => {
            RunRes(0xA2, 0b11000, Cpu.SetD);
            assertReg(Cpu.D(), 0b01000, "D");
        });
        it("RES 4,[HL]", () => {
            RunRes(0xA6, 0b11000, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 16);
            assertMem(0xFF82, 0b01000);
            MemoryMap.GBstore(0xFF82, 0);
        });
        it("RES 5,[HL]", () => {
            RunRes(0xAE, 0b111111, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 16);
            assertMem(0xFF82, 0b11111);
            MemoryMap.GBstore(0xFF82, 0);
        });
        it("RES 6,E", () => {
            RunRes(0xB3, 0b1011010, Cpu.SetE);
            assertReg(Cpu.E(), 0b0011010, "E");
        });
        it("RES 6,A", () => {
            RunRes(0xB7, 0b1011010, Cpu.SetA);
            assertReg(Cpu.A(), 0b0011010, "A");
        });
        it("RES 7,A", () => {
            RunRes(0xBF, 0b11001010, Cpu.SetA);
            assertReg(Cpu.A(), 0b01001010, "A");
        });
    });
    return true;
}
