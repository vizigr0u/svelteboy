import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { setTestRom } from "../cpuTests";
import { describe, it, assertReg, assertCycles, assertMem, assertEquals } from "../framework";

function setLoadReg(opcode: u8, value: u8, setSource: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opcode]);
    setSource(value);
    Cpu.Tick();
    assertCycles(expectedCycles);
}

function setLDValueToReg(opcode: u8, value: u8, moreSetup: () => void = () => { }, expectedCycles: u32 = 8): void {
    setTestRom([opcode, value]);
    moreSetup();
    Cpu.Tick();
    assertCycles(expectedCycles);
}

function setLDReg16ToReg16(opCode: u8, value: u16, setReg: (v: u16) => void, expectedCycles: u32 = 8): void {
    setTestRom([opCode]);
    setReg(value);
    Cpu.Tick();
    assertCycles(expectedCycles);
}

function setLDValue16ToReg(opcode: u8, value: u16, moreSetup: () => void = () => { }, expectedCycles: u32 = 12): void {
    setTestRom([opcode, <u8>(value & 0xff), <u8>(value >> 8 & 0xff)]);
    moreSetup();
    Cpu.Tick();
    assertCycles(expectedCycles);
}

function setLDDerefToReg(opcode: u8, value: u8, setSource: (s: u16) => void, expectedCycles: u32 = 8): void {
    setTestRom([opcode]);
    MemoryMap.GBstore<u8>(0xFF82, value);
    setSource(0xFF82);
    Cpu.Tick();
    assertCycles(expectedCycles);
}

function setLDRegToAddress(opcode: u8, value: u8, address: u16, setSource: (a: u8) => void): void {
    MemoryMap.GBstore<u8>(address, 0); // make sure address is initially empty
    setLoadReg(opcode, value, setSource, 8);
}

function testLDRegToReg(): void {
    it("LD reg,reg", () => {
        setLoadReg(0x40, 42, Cpu.SetB); // LD B, B
        assertReg(Cpu.B(), 42, "B");

        setLoadReg(0x43, 42, Cpu.SetE); // LD B, E
        assertReg(Cpu.B(), 42, "B");

        setLoadReg(0x47, 42, Cpu.SetA); // LD B, A
        assertReg(Cpu.B(), 42, "B");

        setLoadReg(0x4A, 42, Cpu.SetD); // LD C, D
        assertReg(Cpu.C(), 42, "C");

        setLoadReg(0x4D, 42, Cpu.SetL); // LD C, L
        assertReg(Cpu.C(), 42, "C");

        setLoadReg(0x54, 42, Cpu.SetH); // LD D, H
        assertReg(Cpu.D(), 42, "D");

        setLoadReg(0x51, 42, Cpu.SetC); // LD D, C
        assertReg(Cpu.D(), 42, "D");

        setLoadReg(0x58, 42, Cpu.SetB); // LD E, B
        assertReg(Cpu.E(), 42, "E");

        setLoadReg(0x5F, 42, Cpu.SetA); // LD E, A
        assertReg(Cpu.E(), 42, "E");

        setLoadReg(0x62, 42, Cpu.SetD); // LD H, D
        assertReg(Cpu.H(), 42, "H");

        setLoadReg(0x68, 42, Cpu.SetB); // LD L, B
        assertReg(Cpu.L(), 42, "L");

        setLoadReg(0x6D, 42, Cpu.SetL); // LD L, L
        assertReg(Cpu.L(), 42, "L");

        setLoadReg(0x78, 42, Cpu.SetB); // LD A, B
        assertReg(Cpu.A(), 42, "A");

        setLoadReg(0x7C, 42, Cpu.SetH); // LD A, H
        assertReg(Cpu.A(), 42, "A");

        setLoadReg(0x7F, 42, Cpu.SetA); // LD A, A
        assertReg(Cpu.A(), 42, "A");
    });
}

function testLDValueToReg(): void {
    it("LD reg,n8", () => {
        setLDValueToReg(0x06, 42); // LD B, n8
        assertReg(Cpu.B(), 42, "B");

        setLDValueToReg(0x16, 42); // LD D, n8
        assertReg(Cpu.D(), 42, "D");

        setLDValueToReg(0x26, 42); // LD H, n8
        assertReg(Cpu.H(), 42, "H");

        setLDValueToReg(0x0E, 42); // LD C, n8
        assertReg(Cpu.C(), 42, "C");

        setLDValueToReg(0x1E, 42); // LD E, n8
        assertReg(Cpu.E(), 42, "E");

        setLDValueToReg(0x2E, 42); // LD L, n8
        assertReg(Cpu.L(), 42, "L");

        setLDValueToReg(0x3E, 42); // LD A, n8
        assertReg(Cpu.A(), 42, "A");

        setLDValueToReg(0x36, 42, // LD [HL], n8
            () => { MemoryMap.GBstore<u8>(0xFF82, 0); Cpu.HL = 0xFF82; }, 12);
        assertMem(0xFF82, 42);
        MemoryMap.GBstore<u8>(0xFF82, 0);
    });
}

function testLDToDeref(): void {
    it("LD [addr],reg", () => {
        setLDRegToAddress(0x02, 42, 0xFF82, v => { Cpu.SetA(v); Cpu.BC = 0xFF82 }); // LD [BC], A
        assertMem(0xFF82, 42);

        setLDRegToAddress(0x12, 42, 0xFF82, v => { Cpu.SetA(v); Cpu.DE = 0xFF82 }); // LD [DE], A
        assertMem(0xFF82, 42);

        setLDRegToAddress(0x22, 42, 0xFF82, v => { Cpu.SetA(v); Cpu.HL = 0xFF82 }); // LD [HL+], A
        assertMem(0xFF82, 42);
        assert(Cpu.HL = 0x43, `HL = 0x${Cpu.HL.toString(16)} - expected 0xFF83`);

        setLDRegToAddress(0x32, 42, 0xFF82, v => { Cpu.SetA(v); Cpu.HL = 0xFF82 }); // LD [HL-], A
        assertMem(0xFF82, 42);
        assert(Cpu.HL = 0x41, `HL = ${Cpu.HL.toString(16)} - expected 0xFF81`);

        setLDRegToAddress(0x70, 42, 0xFF82, v => { Cpu.SetB(v); Cpu.HL = 0xFF82 }); // LD [HL], B
        assertMem(0xFF82, 42);
        MemoryMap.GBstore<u8>(0xFF82, 0);

        setLDRegToAddress(0x71, 42, 0xFF82, v => { Cpu.SetC(v); Cpu.HL = 0xFF82 }); // LD [HL], C
        assertMem(0xFF82, 42);
        MemoryMap.GBstore<u8>(0xFF82, 0);

        setLDRegToAddress(0x72, 42, 0xFF82, v => { Cpu.SetD(v); Cpu.HL = 0xFF82 }); // LD [HL], D
        assertMem(0xFF82, 42);
        MemoryMap.GBstore<u8>(0xFF82, 0);

        setLDRegToAddress(0x73, 42, 0xFF82, v => { Cpu.SetE(v); Cpu.HL = 0xFF82 }); // LD [HL], E
        assertMem(0xFF82, 42);
        MemoryMap.GBstore<u8>(0xFF82, 0);

        // /!\ H is gonna be changed when we change HL
        setLDRegToAddress(0x74, 42, 0xC042, _ => { Cpu.HL = 0xC042 }); // LD [HL], H
        assertEquals<u8>(MemoryMap.GBload<u8>(0xC042), 0xC0, "[0xC042]");
        MemoryMap.GBstore<u8>(0xFF82, 0);

        // /!\ L is gonna be changed when we change HL
        setLDRegToAddress(0x75, 42, 0xc842, _ => { Cpu.HL = 0xc842 }); // LD [HL], L
        assertEquals<u8>(MemoryMap.GBload<u8>(0xc842), 0x42, "[0xc842]");

        setLDRegToAddress(0x77, 42, 0xFF82, v => { Cpu.SetA(v); Cpu.HL = 0xFF82 }); // LD [HL], A
        assertMem(0xFF82, 42);
        MemoryMap.GBstore<u8>(0xFF82, 0);

        setLDRegToAddress(0xE2, 42, 0xFF42, v => { Cpu.SetA(v); Cpu.SetC(0x42) }); // LD [C] A
        assertMem(0xFF42, 42);
        MemoryMap.GBstore<u8>(0xFF42, 0);

        // 0xEA: LD [a16], A
        setTestRom([0xEA, 0x82, 0xFF]);
        MemoryMap.GBstore<u8>(0xFF82, 0);
        Cpu.SetA(42);
        Cpu.Tick();
        assertCycles(16);
        assertMem(0xFF82, 42);

        MemoryMap.GBstore<u8>(0xFF42, 0);
        MemoryMap.GBstore<u8>(0xFF82, 0);
    });
}

function testLDDerefToReg(): void {
    it("LD reg,[addr]", () => {
        setLDDerefToReg(0x46, 42, v => Cpu.HL = v); // LD B, [HL]
        assertReg(Cpu.B(), 42, "B");

        setLDDerefToReg(0x56, 42, v => Cpu.HL = v); // LD D, [HL]
        assertReg(Cpu.D(), 42, "D");

        setLDDerefToReg(0x66, 42, v => Cpu.HL = v); // LD H, [HL]
        assertReg(Cpu.H(), 42, "H");

        setLDDerefToReg(0x4E, 42, v => Cpu.HL = v); // LD C, [HL]
        assertReg(Cpu.C(), 42, "C");

        setLDDerefToReg(0x5E, 42, v => Cpu.HL = v); // LD E, [HL]
        assertReg(Cpu.E(), 42, "E");

        setLDDerefToReg(0x6E, 42, v => Cpu.HL = v); // LD L, [HL]
        assertReg(Cpu.L(), 42, "L");

        setLDDerefToReg(0x7E, 42, v => Cpu.HL = v); // LD A, [HL]
        assertReg(Cpu.A(), 42, "A");

        setLDDerefToReg(0x0A, 42, v => Cpu.BC = v); // LD A, [BC]
        assertReg(Cpu.A(), 42, "A");

        setLDDerefToReg(0x1A, 42, v => Cpu.DE = v); // LD A, [DE]
        assertReg(Cpu.A(), 42, "A");

        setLDDerefToReg(0x2A, 42, v => Cpu.HL = v); // LD A, [HL+]
        assertReg(Cpu.A(), 42, "A");
        assert(Cpu.HL = 0xFF83, `HL = 0x${Cpu.HL.toString(16)} - expected 0xFF83`);

        setLDDerefToReg(0x3A, 42, v => Cpu.HL = v); // LD A, [HL-]
        assertReg(Cpu.A(), 42, "A");
        assert(Cpu.HL = 0xFF81, `HL = 0x${Cpu.HL.toString(16)} - expected 0xFF81`);

        // LD A, [C] => [0xFF00 + C]
        setTestRom([0xF2]);
        MemoryMap.GBstore<u8>(0xFF42, <u8>(42));
        Cpu.SetC(0x42);
        Cpu.Tick();
        assertCycles(8);
        assertReg(Cpu.A(), 42, "A");
    });
}

function testLD16bits(): void {
    it("LD A,[a16]", () => {
        setLDValue16ToReg(0xFA, 0xFF82, () => MemoryMap.GBstore<u8>(0xFF82, <u8>(42)), 16);
        assertReg(Cpu.A(), 42, "A");

        setLDValue16ToReg(0xFA, 0xC042, () => MemoryMap.GBstore<u8>(0xC042, <u8>(63)), 16);
        assertReg(Cpu.A(), 63, "A");

        setLDValue16ToReg(0xFA, 0xFF84, () => MemoryMap.GBstore<u8>(0xFF84, <u8>(200)), 16);
        assertReg(Cpu.A(), 200, "A");
    });

    it("LD r16,n16", () => {
        setLDValue16ToReg(0x01, 0xDEAD); // LD BC, n16
        assertEquals<u16>(Cpu.BC, 0xDEAD, "BC");
        MemoryMap.GBstore<u8>(0xDEAD, 0);

        setLDValue16ToReg(0x11, 0xBEEF); // LD DE, n16
        assertEquals<u16>(Cpu.DE, 0xBEEF, "DE");
        MemoryMap.GBstore<u8>(0xBEEF, 0);

        setLDValue16ToReg(0x21, 0x1337); // LD HL, n16
        assertEquals<u16>(Cpu.HL, 0x1337, "HL");
        MemoryMap.GBstore<u8>(0x1337, 0);

        setLDValue16ToReg(0x31, 0xBABA); // LD SP, n16
        assertEquals<u16>(Cpu.StackPointer, 0xBABA, "SP");
        MemoryMap.GBstore<u8>(0xBABA, 0);
    });

    it("LD [a16],SP", () => {
        setLDValue16ToReg(0x08, 0xDEAD, () => { MemoryMap.GBstore<u16>(0xDEAD, 0); Cpu.StackPointer = 42 }, 20);
        assertEquals<u16>(MemoryMap.GBload<u16>(0xDEAD), 42, "[0xDEAD]");
        MemoryMap.GBstore<u16>(0xDEAD, 0);

        setLDValue16ToReg(0x08, 0xDEAD, () => { MemoryMap.GBstore<u16>(0xDEAD, 0); Cpu.StackPointer = 0xBEEF }, 20);
        assertEquals<u16>(MemoryMap.GBload<u16>(0xDEAD), 0xBEEF, "[0xDEAD]");
        MemoryMap.GBstore<u16>(0xDEAD, 0);

        setLDValue16ToReg(0x08, 0xDEAD, () => { MemoryMap.GBstore<u16>(0xDEAD, 0); Cpu.StackPointer = 0xFE00 }, 20);
        assertEquals<u16>(MemoryMap.GBload<u16>(0xDEAD), 0xFE00, "[0xDEAD]");
        MemoryMap.GBstore<u16>(0xDEAD, 0);
    });

    it("LD SP,HL", () => {
        setLDReg16ToReg16(0xF9, 0xDEAD, v => Cpu.HL = v);
        assertEquals<u16>(Cpu.StackPointer, 0xDEAD, "SP");

        setLDReg16ToReg16(0xF9, 42, v => Cpu.HL = v);
        assertEquals<u16>(Cpu.StackPointer, 42, "SP");

        setLDReg16ToReg16(0xF9, 0xFF00, v => Cpu.HL = v);
        assertEquals<u16>(Cpu.StackPointer, 0xFF00, "SP");
    });
}

function test0xF8_LD_HL_SP_e8(): void {
    it("LD HL,SP+e8", () => {
        setTestRom([0xF8, 17]);
        Cpu.StackPointer = 25;
        Cpu.Tick();
        assertCycles(12);
        assertEquals<u16>(Cpu.HL, 42, "HL");

        setTestRom([0xF8, 0x42]);
        Cpu.StackPointer = 0xFF00;
        Cpu.Tick();
        assertCycles(12);
        assertEquals<u16>(Cpu.HL, 0xFF42, "HL");

        setTestRom([0xF8, 0x42]);
        Cpu.StackPointer = 0x00FF;
        Cpu.Tick();
        assertCycles(12);
        assertEquals<u16>(Cpu.HL, 0x0141, "HL");
    });
}

function testLDH(): void {
    it("LDH [a8],A and LDH A,[a8]", () => {
        setTestRom([0xe0, 0x82]);
        Cpu.SetA(42);
        Cpu.Tick();
        assertCycles(12);
        assertMem(0xFF82, 42);
        MemoryMap.GBstore<u8>(0xFF82, 0);

        setTestRom([0xe0, 0x80]);
        Cpu.SetA(42);
        Cpu.Tick();
        assertCycles(12);
        assertMem(0xFF80, 42);
        MemoryMap.GBstore<u8>(0xFF80, 0);

        setTestRom([0xf0, 0x82]);
        MemoryMap.GBstore(0xFF82, 42);
        Cpu.Tick();
        MemoryMap.GBstore(0xFF82, 0);
        assertCycles(12);
        assertReg(Cpu.A(), 42, "A");

        setTestRom([0xf0, 0x80]);
        MemoryMap.GBstore(0xFF80, 42);
        Cpu.Tick();
        MemoryMap.GBstore(0xFF80, 0);
        assertCycles(12);
        assertReg(Cpu.A(), 42, "A");
    });
}

export function testLD(): boolean {
    describe("LD", () => {
        testLDRegToReg();
        testLDValueToReg();
        testLDToDeref();
        testLDDerefToReg();
        testLD16bits();
        test0xF8_LD_HL_SP_e8();
        testLDH();
    });
    return true;
}
