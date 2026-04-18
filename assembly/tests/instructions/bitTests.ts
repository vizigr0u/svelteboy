import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertCycles, assertFlags } from "../framework";

function RunBit(opCode: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 8): void {
    setTestRom([0xCB, opCode]);
    setB(b);
    Cpu.Tick();
    // expect 4 more for PREFIX op
    assertCycles(expectedCycles + 4);
}

export function testBit(): boolean {
    // After BIT: N=0, H=1, C unchanged (=1 from Cpu.Init AF=0x01B0)
    describe("BIT", () => {
        it("BIT 0,B even (zero)", () => {
            RunBit(0x40, 42, Cpu.SetB);
            assertFlags(true, false, true, true);
        });
        it("BIT 0,B odd (non-zero)", () => {
            RunBit(0x40, 41, Cpu.SetB);
            assertFlags(false, false, true, true);
        });
        it("BIT 0,H even (zero)", () => {
            RunBit(0x44, 42, Cpu.SetH);
            assert(Cpu.FlagZ());
        });
        it("BIT 1,H 0b1110 (non-zero)", () => {
            RunBit(0x4C, 0b1110, Cpu.SetH);
            assert(!Cpu.FlagZ());
        });
        it("BIT 2,C 0b110 (non-zero)", () => {
            RunBit(0x51, 0b110, Cpu.SetC);
            assert(!Cpu.FlagZ());
        });
        it("BIT 2,L 0b010 (zero)", () => {
            RunBit(0x55, 0b010, Cpu.SetL);
            assert(Cpu.FlagZ());
        });
        it("BIT 3,L 0b0010 (zero)", () => {
            RunBit(0x5D, 0b0010, Cpu.SetL);
            assert(Cpu.FlagZ());
        });
        it("BIT 4,D 0b11000 (non-zero)", () => {
            RunBit(0x62, 0b11000, Cpu.SetD);
            assert(!Cpu.FlagZ());
        });
        it("BIT 4,[HL] 0b00111 (zero)", () => {
            RunBit(0x66, 0b00111, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 12);
            assert(Cpu.FlagZ());
        });
        it("BIT 5,[HL] 0b111111 (non-zero)", () => {
            RunBit(0x6E, 0b111111, v => { MemoryMap.GBstore(0xFF82, v); Cpu.HL = 0xFF82 }, 12);
            assert(!Cpu.FlagZ());
        });
        it("BIT 6,E 0b0011010 (zero)", () => {
            RunBit(0x73, 0b0011010, Cpu.SetE);
            assert(Cpu.FlagZ());
        });
        it("BIT 6,A 0b1110011 (non-zero)", () => {
            RunBit(0x77, 0b1110011, Cpu.SetA);
            assert(!Cpu.FlagZ());
        });
        it("BIT 7,A 0b10001000 (non-zero)", () => {
            RunBit(0x7F, 0b10001000, Cpu.SetA);
            assert(!Cpu.FlagZ());
        });
    });
    return true;
}
