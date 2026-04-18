import { ClearHLDerefTest, HLDeref, SetHLDeref } from ".";
import { Cpu, Flag } from "../../cpu/cpu";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles } from "../framework";

function RunRr(opCode: u8, carry: bool, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.SetFlag(Flag.C_Carry, carry);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assertCycles(expectedCycles + 4);
}

export function testRr(): boolean {
    describe("RR", () => {
        it("RR B carry-in=0, LSB=1 → carry-out=1", () => {
            RunRr(0x18, 0, 0b10101111, Cpu.SetB);
            assertReg(Cpu.B(), 0b1010111, "B");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RR B carry-in=1, LSB=1", () => {
            RunRr(0x18, 1, 0b10101111, Cpu.SetB);
            assertReg(Cpu.B(), 0b11010111, "B");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RR C carry-in=1", () => {
            RunRr(0x19, 1, 0b10101111, Cpu.SetC);
            assertReg(Cpu.C(), 0b11010111, "C");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RR D carry-in=1, LSB=0 → carry-out=0", () => {
            RunRr(0x1A, 1, 0b00101110, Cpu.SetD);
            assertReg(Cpu.D(), 0b10010111, "D");
            assert(!Cpu.FlagC(), `expected non Carry`);
        });
        it("RR E carry-in=1", () => {
            RunRr(0x1B, 1, 0b10101111, Cpu.SetE);
            assertReg(Cpu.E(), 0b11010111, "E");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RR H carry-in=1", () => {
            RunRr(0x1C, 1, 0b10101111, Cpu.SetH);
            assertReg(Cpu.H(), 0b11010111, "H");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RR L carry-in=1", () => {
            RunRr(0x1D, 1, 0b10101111, Cpu.SetL);
            assertReg(Cpu.L(), 0b11010111, "L");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RR [HL] carry-in=1", () => {
            RunRr(0x1E, 1, 0b10101111, SetHLDeref, 16);
            assertReg(<u8>HLDeref(), 0b11010111, "[HL]");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RR A carry-in=0, non-zero result", () => {
            RunRr(0x1F, 0, 0b10101111, Cpu.SetA);
            assertReg(Cpu.A(), 0b1010111, "A");
            assert(Cpu.FlagC(), `expected Carry`);
            assert(!Cpu.FlagZ(), `expected Non zero`);
        });
        it("RR A carry-in=0, zero result", () => {
            RunRr(0x1F, 0, 0b00000001, Cpu.SetA);
            assertReg(Cpu.A(), 0b00000000, "A");
            assert(Cpu.FlagC(), `expected Carry`);
            assert(Cpu.FlagZ(), `expected zero`);
        });
        ClearHLDerefTest();
    });
    return true;
}
