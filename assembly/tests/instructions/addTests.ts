import { Cpu, Flag } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertEquals } from "../framework";

function RunAdd8(addInstruction: u8, a: u8, b: u8, setA: (a: u8) => void, setB: (a: u8) => void): void {
    setTestRom([addInstruction]);
    setA(a);
    setB(b);
    Cpu.Tick();
}

function RunAddToA(addInstruction: u8, a: u8, b: u8, setB: (a: u8) => void): void {
    RunAdd8(addInstruction, a, b, Cpu.SetA, setB);
}

function RunAddToHL(addInstruction: u8, a: u16, b: u16, setB: (a: u16) => void): void {
    setTestRom([addInstruction]);
    Cpu.HL = a;
    setB(b);
    Cpu.Tick();
}

function RunAddToSP(a: u16, b: u8, preExecute: () => void = () => { }): void {
    setTestRom([0xE8, b]);
    Cpu.SetFlag(Flag.N_Sub);
    Cpu.StackPointer = a;
    preExecute();
    Cpu.Tick();
}

function RunAddValue_0xC6(a: u8, b: u8): void {
    setTestRom([0xC6, b]);
    Cpu.SetA(a);
    Cpu.Tick();
}

function RunAddDerefHL_0x86(a: u8, b: u8): void {
    const placeForB: u16 = 0xFF82;
    RunAddToA(0x86, a, b, (b) => {
        MemoryMap.GBstore<u8>(placeForB, b);
        Cpu.HL = placeForB;
    });
    assertEquals<u16>(Cpu.HL, placeForB, "HL");
    assertEquals<u8>(MemoryMap.GBload<u8>(placeForB), b, "[0xFF82]");
}

export function testAdd(): boolean {
    describe("ADD", () => {
        it("ADD A,B 2+5=7", () => {
            RunAddToA(0x80, 2, 5, Cpu.SetB);
            assertReg(Cpu.A(), 7, "A");
            assert(!Cpu.FlagZ());
            assert(!Cpu.FlagC());
        });
        it("ADD A,B 0+0=0 (zero)", () => {
            RunAddToA(0x80, 0, 0, Cpu.SetB);
            assertReg(Cpu.A(), 0, "A");
            assert(Cpu.FlagZ());
            assert(!Cpu.FlagC());
        });
        it("ADD A,B 0xFE+1=0xFF (no overflow)", () => {
            RunAddToA(0x80, 0xFE, 1, Cpu.SetB);
            assertReg(Cpu.A(), 0xFF, "A");
            assert(!Cpu.FlagZ());
            assert(!Cpu.FlagC());
        });
        it("ADD A,B 0xFF+1=0 (overflow)", () => {
            RunAddToA(0x80, 0xFF, 1, Cpu.SetB);
            assertReg(Cpu.A(), 0, "A");
            assert(Cpu.FlagZ());
            assert(Cpu.FlagC());
        });
        it("ADD A,B 0xFF+0xFF=0xFE (overflow)", () => {
            RunAddToA(0x80, 0xFF, 0xFF, Cpu.SetB);
            assertReg(Cpu.A(), 0xFE, "A");
            assert(!Cpu.FlagZ());
            assert(Cpu.FlagC());
        });
        it("ADD A,C", () => {
            RunAddToA(0x81, 25, 17, Cpu.SetC);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,D", () => {
            RunAddToA(0x82, 25, 17, Cpu.SetD);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,E", () => {
            RunAddToA(0x83, 25, 17, Cpu.SetE);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,H", () => {
            RunAddToA(0x84, 25, 17, Cpu.SetH);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,L", () => {
            RunAddToA(0x85, 25, 17, Cpu.SetL);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,[HL] 25+17=42", () => {
            RunAddDerefHL_0x86(25, 17);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,[HL] 0+17=17", () => {
            RunAddDerefHL_0x86(0, 17);
            assertReg(Cpu.A(), 17, "A");
        });
        it("ADD A,[HL] 5+255=4 (overflow)", () => {
            RunAddDerefHL_0x86(5, 255);
            assertReg(Cpu.A(), 4, "A");
            assert(Cpu.FlagC());
        });
        it("ADD A,A 21+21=42", () => {
            RunAddToA(0x87, 21, 21, Cpu.SetA);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,n8 25+17=42", () => {
            RunAddValue_0xC6(25, 17);
            assertReg(Cpu.A(), 42, "A");
        });
        it("ADD A,n8 0+17=17", () => {
            RunAddValue_0xC6(0, 17);
            assertReg(Cpu.A(), 17, "A");
        });
        it("ADD A,n8 255+2=1 (overflow)", () => {
            RunAddValue_0xC6(255, 2);
            assertReg(Cpu.A(), 1, "A");
            assert(Cpu.FlagC());
        });
        it("ADD A,n8 2+255=1 (overflow)", () => {
            RunAddValue_0xC6(2, 255);
            assertReg(Cpu.A(), 1, "A");
            assert(Cpu.FlagC());
        });
        it("ADD HL,BC", () => {
            RunAddToHL(0x09, 25, 17, (v: u16) => Cpu.BC = v);
            assertEquals<u16>(Cpu.HL, 42, "HL");
        });
        it("ADD HL,DE", () => {
            RunAddToHL(0x19, 25, 17, (v: u16) => Cpu.DE = v);
            assertEquals<u16>(Cpu.HL, 42, "HL");
        });
        it("ADD HL,HL", () => {
            RunAddToHL(0x29, 21, 21, (v: u16) => Cpu.HL = v);
            assertEquals<u16>(Cpu.HL, 42, "HL");
        });
        it("ADD HL,SP", () => {
            RunAddToHL(0x39, 25, 17, (v: u16) => Cpu.StackPointer = v);
            assertEquals<u16>(Cpu.HL, 42, "HL");
        });
        it("ADD HL,SP preserves Z flag", () => {
            RunAddToHL(0x39, 25, 17, (v: u16) => {
                Cpu.SetF(<u8>Flag.Z_Zero);
                Cpu.StackPointer = v;
            });
            assertEquals<u16>(Cpu.HL, 42, "HL");
            assert(Cpu.FlagZ());
        });
        it("ADD HL,SP 0+0=0 sets Z", () => {
            RunAddToHL(0x39, 0, 0, (v: u16) => Cpu.StackPointer = v);
            assertEquals<u16>(Cpu.HL, 0, "HL");
            assert(Cpu.FlagZ());
        });
        it("ADD SP,e8 0+0=0 clears Z,N", () => {
            RunAddToSP(0, 0);
            assert(!Cpu.FlagZ());
            assert(!Cpu.FlagN());
            assertEquals<u16>(Cpu.StackPointer, 0, "SP");
        });
        it("ADD SP,e8 17+25=42 clears Z,N", () => {
            RunAddToSP(17, 25, () => Cpu.SetF(<u8>Flag.Z_Zero));
            assert(!Cpu.FlagZ());
            assert(!Cpu.FlagN());
            assertEquals<u16>(Cpu.StackPointer, 42, "SP");
        });
    });
    return true;
}
