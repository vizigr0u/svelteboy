import { ClearHLDerefTest, HLDeref, SetHLDeref } from ".";
import { Cpu, Flag } from "../../cpu/cpu";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles } from "../framework";

function RunRl(opCode: u8, carry: bool, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.SetFlag(Flag.C_Carry, carry);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assertCycles(expectedCycles + 4);
}

export function testRl(): boolean {
    describe("RL", () => {
        it("RL B carry-in=0, MSB=1 → carry-out=1", () => {
            RunRl(0x10, 0, 0b10101110, Cpu.SetB);
            assertReg(Cpu.B(), 0b01011100, "B");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RL B carry-in=1, MSB=1", () => {
            RunRl(0x10, 1, 0b10101110, Cpu.SetB);
            assertReg(Cpu.B(), 0b01011101, "B");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RL C carry-in=1", () => {
            RunRl(0x11, 1, 0b10101110, Cpu.SetC);
            assertReg(Cpu.C(), 0b01011101, "C");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RL D carry-in=1, MSB=0 → carry-out=0", () => {
            RunRl(0x12, 1, 0b00101110, Cpu.SetD);
            assertReg(Cpu.D(), 0b01011101, "D");
            assert(!Cpu.FlagC(), `expected non Carry`);
        });
        it("RL E carry-in=1", () => {
            RunRl(0x13, 1, 0b10101110, Cpu.SetE);
            assertReg(Cpu.E(), 0b01011101, "E");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RL H carry-in=1", () => {
            RunRl(0x14, 1, 0b10101110, Cpu.SetH);
            assertReg(Cpu.H(), 0b01011101, "H");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RL L carry-in=1", () => {
            RunRl(0x15, 1, 0b10101110, Cpu.SetL);
            assertReg(Cpu.L(), 0b01011101, "L");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RL [HL] carry-in=1", () => {
            RunRl(0x16, 1, 0b10101110, SetHLDeref, 16);
            assertReg(<u8>HLDeref(), 0b01011101, "[HL]");
            assert(Cpu.FlagC(), `expected Carry`);
        });
        it("RL A carry-in=0, non-zero result", () => {
            RunRl(0x17, 0, 0b10101110, Cpu.SetA);
            assertReg(Cpu.A(), 0b01011100, "A");
            assert(Cpu.FlagC(), `expected Carry`);
            assert(!Cpu.FlagZ(), `expected Non zero`);
        });
        it("RL A carry-in=0, zero result", () => {
            RunRl(0x17, 0, 0b10000000, Cpu.SetA);
            assertReg(Cpu.A(), 0b00000000, "A");
            assert(Cpu.FlagC(), `expected Carry`);
            assert(Cpu.FlagZ(), `expected zero`);
        });
        ClearHLDerefTest();
    });
    return true;
}
