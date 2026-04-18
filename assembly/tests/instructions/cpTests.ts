import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertCycles, assertFlags } from "../framework";

function RunCp(opCode: u8, a: u8, b: u8, setB: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opCode]);
    Cpu.SetA(a);
    setB(b);
    Cpu.Tick();
    assertCycles(expectedCycles);
    assert(Cpu.FlagN());
}

function RunCpValue(opCode: u8, a: u8, b: u8): void {
    setTestRom([opCode, b]);
    Cpu.SetA(a);
    Cpu.Tick();
    assertCycles(8);
    assert(Cpu.FlagN());
}

export function testCp(): boolean {
    describe("CP", () => {
        it("CP A,B 22<24 (borrow)", () => {
            RunCp(0xB8, 22, 24, Cpu.SetB);
            assertFlags(false, true, true, true);
        });
        it("CP A,C 42==42 (zero)", () => {
            RunCp(0xB9, 42, 42, Cpu.SetC);
            assertFlags(true, true, false, false);
        });
        it("CP A,D 22<24 (borrow)", () => {
            RunCp(0xBA, 22, 24, Cpu.SetD);
            assertFlags(false, true, true, true);
        });
        it("CP A,E 0xFA>0x12 (no borrow)", () => {
            RunCp(0xBB, 0xFA, 0x12, Cpu.SetE);
            assertFlags(false, true, false, false);
        });
        it("CP A,H 22<24 (borrow)", () => {
            RunCp(0xBC, 22, 24, Cpu.SetH);
            assertFlags(false, true, true, true);
        });
        it("CP A,L 22<24 (borrow)", () => {
            RunCp(0xBD, 22, 24, Cpu.SetL);
            assertFlags(false, true, true, true);
        });
        it("CP A,A (zero)", () => {
            RunCp(0xBF, 42, 0xFE, Cpu.SetA);
            assertFlags(true, true, false, false);
        });
        it("CP A,[HL] 22<25 (borrow)", () => {
            RunCp(0xBE, 22, 25, v => { MemoryMap.GBstore<u8>(0xFF82, v); Cpu.HL = 0xFF82 }, 8);
            assertFlags(false, true, true, true);
        });
        it("CP A,[HL] 42==42 (zero)", () => {
            RunCp(0xBE, 42, 42, v => { MemoryMap.GBstore<u8>(0xFF82, v); Cpu.HL = 0xFF82 }, 8);
            assertFlags(true, true, false, false);
        });
        it("CP A,n8 22<25 (borrow)", () => {
            RunCpValue(0xFE, 22, 25);
            assertFlags(false, true, true, true);
        });
    });
    return true;
}
