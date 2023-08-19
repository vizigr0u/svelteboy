import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../cpu/memoryMap";
import { setTestRom } from "../cpuTests";

function setLoadReg(opcode: u8, value: u8, setSource: (a: u8) => void, expectedCycles: u32 = 4): void {
    setTestRom([opcode]);
    setSource(value);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
}

function setLDValueToReg(opcode: u8, value: u8, moreSetup: () => void = () => { }, expectedCycles: u32 = 8): void {
    setTestRom([opcode, value]);
    moreSetup();
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
}

function setLDReg16ToReg16(opCode: u8, value: u16, setReg: (v: u16) => void, expectedCycles: u32 = 8): void {
    setTestRom([opCode]);
    setReg(value);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
}

function setLDValue16ToReg(opcode: u8, value: u16, moreSetup: () => void = () => { }, expectedCycles: u32 = 12): void {
    setTestRom([opcode, <u8>(value & 0xff), <u8>(value >> 8 & 0xff)]);
    moreSetup();
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
}

function setLDDerefToReg(opcode: u8, value: u8, setSource: (s: u16) => void, expectedCycles: u32 = 8): void {
    setTestRom([opcode]);
    MemoryMap.GBstore<u8>(0x42, value);
    setSource(0x42);
    Cpu.Tick();
    assert(Cpu.CycleCount == expectedCycles);
}

function setLDRegToAddress(opcode: u8, value: u8, address: u16, setSource: (a: u8) => void): void {
    MemoryMap.GBstore<u8>(address, 0); // make sure address is initially empty
    setLoadReg(opcode, value, setSource, 8);
}

function testLDRegToReg(): void {
    setLoadReg(0x40, 42, Cpu.SetB); // LD B, B
    assert(Cpu.B() == 42);

    setLoadReg(0x43, 42, Cpu.SetE); // LD B, E
    assert(Cpu.B() == 42);

    setLoadReg(0x47, 42, Cpu.SetA); // LD B, A
    assert(Cpu.B() == 42);

    setLoadReg(0x4A, 42, Cpu.SetD); // LD C, D
    assert(Cpu.C() == 42);

    setLoadReg(0x4D, 42, Cpu.SetL); // LD C, L
    assert(Cpu.C() == 42);

    setLoadReg(0x54, 42, Cpu.SetH); // LD D, H
    assert(Cpu.D() == 42);

    setLoadReg(0x51, 42, Cpu.SetC); // LD D, C
    assert(Cpu.D() == 42);

    setLoadReg(0x58, 42, Cpu.SetB); // LD E, B
    assert(Cpu.E() == 42);

    setLoadReg(0x5F, 42, Cpu.SetA); // LD E, A
    assert(Cpu.E() == 42);

    setLoadReg(0x62, 42, Cpu.SetD); // LD H, D
    assert(Cpu.H() == 42);

    setLoadReg(0x68, 42, Cpu.SetB); // LD L, B
    assert(Cpu.L() == 42);

    setLoadReg(0x6D, 42, Cpu.SetL); // LD L, L
    assert(Cpu.L() == 42);

    setLoadReg(0x78, 42, Cpu.SetB); // LD A, B
    assert(Cpu.A() == 42);

    setLoadReg(0x7C, 42, Cpu.SetH); // LD A, H
    assert(Cpu.A() == 42);

    setLoadReg(0x7F, 42, Cpu.SetA); // LD A, A
    assert(Cpu.A() == 42);
}

function testLDValueToReg(): void {
    setLDValueToReg(0x06, 42); // LD B, n8
    assert(Cpu.B() == 42, `B = ${Cpu.B()}`);

    setLDValueToReg(0x16, 42); // LD D, n8
    assert(Cpu.D() == 42, `D = ${Cpu.D()}`);

    setLDValueToReg(0x26, 42); // LD H, n8
    assert(Cpu.H() == 42, `H = ${Cpu.H()}`);

    setLDValueToReg(0x0E, 42); // LD C, n8
    assert(Cpu.C() == 42, `C = ${Cpu.C()}`);

    setLDValueToReg(0x1E, 42); // LD E, n8
    assert(Cpu.E() == 42, `E = ${Cpu.E()}`);

    setLDValueToReg(0x2E, 42); // LD L, n8
    assert(Cpu.L() == 42, `L = ${Cpu.L()}`);

    setLDValueToReg(0x3E, 42); // LD A, n8
    assert(Cpu.A() == 42, `A = ${Cpu.A()}`);

    setLDValueToReg(0x36, 42, // LD [HL], n8
        () => { MemoryMap.GBstore<u8>(0x42, 0); Cpu.HL = 0x42; }, 12);
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    MemoryMap.GBstore<u8>(0x42, 0);
}

function testLDToDeref(): void {
    setLDRegToAddress(0x02, 42, 0x42, v => { Cpu.SetA(v); Cpu.BC = 0x42 }); // LD [BC], A
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);

    setLDRegToAddress(0x12, 42, 0x42, v => { Cpu.SetA(v); Cpu.DE = 0x42 }); // LD [DE], A
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);

    setLDRegToAddress(0x22, 42, 0x42, v => { Cpu.SetA(v); Cpu.HL = 0x42 }); // LD [HL+], A
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    assert(Cpu.HL = 0x43, `HL = 0x${Cpu.HL.toString(16)} - expected 0x43`);

    setLDRegToAddress(0x32, 42, 0x42, v => { Cpu.SetA(v); Cpu.HL = 0x42 }); // LD [HL-], A
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    assert(Cpu.HL = 0x41, `HL = ${Cpu.HL.toString(16)} - expected 0x41`);

    setLDRegToAddress(0x70, 42, 0x42, v => { Cpu.SetB(v); Cpu.HL = 0x42 }); // LD [HL], B
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    MemoryMap.GBstore<u8>(0x42, 0);

    setLDRegToAddress(0x71, 42, 0x42, v => { Cpu.SetC(v); Cpu.HL = 0x42 }); // LD [HL], C
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    MemoryMap.GBstore<u8>(0x42, 0);

    setLDRegToAddress(0x72, 42, 0x42, v => { Cpu.SetD(v); Cpu.HL = 0x42 }); // LD [HL], D
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    MemoryMap.GBstore<u8>(0x42, 0);

    setLDRegToAddress(0x73, 42, 0x42, v => { Cpu.SetE(v); Cpu.HL = 0x42 }); // LD [HL], E
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    MemoryMap.GBstore<u8>(0x42, 0);

    // /!\ H is gonna be changed when we change HL
    setLDRegToAddress(0x74, 42, 0x4228, _ => { Cpu.HL = 0x4228 }); // LD [HL], H
    assert(MemoryMap.GBload<u8>(0x4228) == 0x42, `[0x4228] = ${MemoryMap.GBload<u8>(0x4228).toString(16)} - expected 0x42`);
    MemoryMap.GBstore<u8>(0x42, 0);

    // /!\ L is gonna be changed when we change HL
    setLDRegToAddress(0x75, 42, 0x2842, _ => { Cpu.HL = 0x2842 }); // LD [HL], L
    assert(MemoryMap.GBload<u8>(0x2842) == 0x42, `[0x2842] = ${MemoryMap.GBload<u8>(0x2842).toString(16)} - expected 0x42`);

    setLDRegToAddress(0x77, 42, 0x42, v => { Cpu.SetA(v); Cpu.HL = 0x42 }); // LD [HL], A
    assert(MemoryMap.GBload<u8>(0x42) == 42, `[0x42] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);
    MemoryMap.GBstore<u8>(0x42, 0);

    setLDRegToAddress(0xE2, 42, 0xFF42, v => { Cpu.SetA(v); Cpu.SetC(0x42) }); // LD [C] A = LD [C + 0xFF00] A
    assert(MemoryMap.GBload<u8>(0xFF42) == 42, `[0xFF42] = ${MemoryMap.GBload<u8>(0xFF42).toString()} - expected 42`);
    MemoryMap.GBstore<u8>(0xFF42, 0);

    // 0xEA: LD [a16], A
    setTestRom([0xEA, 0x42, 0x00]); // Little Endian: a16 will be read 0x0042
    MemoryMap.GBstore<u8>(0x42, 0);
    Cpu.SetA(42);
    Cpu.Tick();
    assert(Cpu.CycleCount == 16);
    assert(MemoryMap.GBload<u8>(0x0042) == 42, `[0x0042] = ${MemoryMap.GBload<u8>(0x42).toString()} - expected 42`);

    MemoryMap.GBstore<u8>(0xFF42, 0);
    MemoryMap.GBstore<u8>(0x42, 0);
}

function testLDDerefToReg(): void {
    setLDDerefToReg(0x46, 42, v => Cpu.HL = v); // LD B, [HL]
    assert(Cpu.B() == 42, `B = ${Cpu.B()}, expected 42`);

    setLDDerefToReg(0x56, 42, v => Cpu.HL = v); // LD D, [HL]
    assert(Cpu.D() == 42, `D = ${Cpu.D()}, expected 42`);

    setLDDerefToReg(0x66, 42, v => Cpu.HL = v); // LD H, [HL]
    assert(Cpu.H() == 42, `H = ${Cpu.H()}, expected 42`);

    setLDDerefToReg(0x4E, 42, v => Cpu.HL = v); // LD C, [HL]
    assert(Cpu.C() == 42, `C = ${Cpu.C()}, expected 42`);

    setLDDerefToReg(0x5E, 42, v => Cpu.HL = v); // LD E, [HL]
    assert(Cpu.E() == 42, `E = ${Cpu.E()}, expected 42`);

    setLDDerefToReg(0x6E, 42, v => Cpu.HL = v); // LD L, [HL]
    assert(Cpu.L() == 42, `L = ${Cpu.L()}, expected 42`);

    setLDDerefToReg(0x7E, 42, v => Cpu.HL = v); // LD A, [HL]
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);

    setLDDerefToReg(0x0A, 42, v => Cpu.BC = v); // LD A, [BC]
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);

    setLDDerefToReg(0x1A, 42, v => Cpu.DE = v); // LD A, [DE]
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);

    setLDDerefToReg(0x2A, 42, v => Cpu.HL = v); // LD A, [HL+]
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);
    assert(Cpu.HL = 0x43, `HL = 0x${Cpu.HL.toString(16)} - expected 0x43`);

    setLDDerefToReg(0x3A, 42, v => Cpu.HL = v); // LD A, [HL-]
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);
    assert(Cpu.HL = 0x41, `HL = 0x${Cpu.HL.toString(16)} - expected 0x41`);

    // LD A, [C] => [0xFF00 + C]
    setTestRom([0xF2]);
    MemoryMap.GBstore<u8>(0xFF42, <u8>(42));
    Cpu.SetC(0x42);
    Cpu.Tick();
    assert(Cpu.CycleCount == 8);
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);
}

function testLD16bits(): void {
    // 0xFA - LD A, [a16]
    setLDValue16ToReg(0xFA, 0x20, () => MemoryMap.GBstore<u8>(0x20, <u8>(42)), 16);
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);

    setLDValue16ToReg(0xFA, 0x2000, () => MemoryMap.GBstore<u8>(0x2000, <u8>(63)), 16);
    assert(Cpu.A() == 63, `A = ${Cpu.A()}, expected 63`);

    setLDValue16ToReg(0xFA, 0xFF84, () => MemoryMap.GBstore<u8>(0xFF84, <u8>(200)), 16);
    assert(Cpu.A() == 200, `A = ${Cpu.A()}, expected 200`);


    setLDValue16ToReg(0x01, 0xDEAD); // LD BC, n16
    assert(Cpu.BC == 0xDEAD, `BC = 0x${Cpu.BC.toString(16)}, expecting 0xDEAD`);
    MemoryMap.GBstore<u8>(0xDEAD, 0);

    setLDValue16ToReg(0x11, 0xBEEF); // LD DE, n16
    assert(Cpu.DE == 0xBEEF, `DE = 0x${Cpu.DE.toString(16)}, expecting 0xBEEF`);
    MemoryMap.GBstore<u8>(0xBEEF, 0);

    setLDValue16ToReg(0x21, 0x1337); // LD HL, n16
    assert(Cpu.HL == 0x1337, `HL = 0x${Cpu.HL.toString(16)}, expecting 0xDEAD`);
    MemoryMap.GBstore<u8>(0x1337, 0);

    setLDValue16ToReg(0x31, 0xBABA); // LD SP, n16
    assert(Cpu.StackPointer == 0xBABA, `SP = 0x${Cpu.StackPointer.toString(16)}, expecting 0xBABA`);
    MemoryMap.GBstore<u8>(0xBABA, 0);

    // LD [a16], SP
    setLDValue16ToReg(0x08, 0xDEAD, () => { MemoryMap.GBstore<u16>(0xDEAD, 0); Cpu.StackPointer = 42 }, 20);
    assert(MemoryMap.GBload<u16>(0xDEAD) == 42, `[0xDEAD] = ${MemoryMap.GBload<u16>(0xDEAD)}, expected 42\n`);
    MemoryMap.GBstore<u16>(0xDEAD, 0);

    setLDValue16ToReg(0x08, 0xDEAD, () => { MemoryMap.GBstore<u16>(0xDEAD, 0); Cpu.StackPointer = 0xBEEF }, 20);
    assert(MemoryMap.GBload<u16>(0xDEAD) == 0xBEEF, `[0xDEAD] = ${MemoryMap.GBload<u16>(0xDEAD)}, expected 0xBEEF\n`);
    MemoryMap.GBstore<u16>(0xDEAD, 0);

    setLDValue16ToReg(0x08, 0xDEAD, () => { MemoryMap.GBstore<u16>(0xDEAD, 0); Cpu.StackPointer = 0xFE00 }, 20);
    assert(MemoryMap.GBload<u16>(0xDEAD) == 0xFE00, `[0xDEAD] = ${MemoryMap.GBload<u16>(0xDEAD)}, expected 0xFE00\n`);
    MemoryMap.GBstore<u16>(0xDEAD, 0);

    // LD SP, HL
    setLDReg16ToReg16(0xF9, 0xDEAD, v => Cpu.HL = v);
    assert(Cpu.StackPointer == 0xDEAD, `SP = ${Cpu.StackPointer}, expected 0xDEAD\n`);

    setLDReg16ToReg16(0xF9, 42, v => Cpu.HL = v);
    assert(Cpu.StackPointer == 42, `SP = ${Cpu.StackPointer}, expected 42\n`);

    setLDReg16ToReg16(0xF9, 0xFF00, v => Cpu.HL = v);
    assert(Cpu.StackPointer == 0xFF00, `SP = ${Cpu.StackPointer}, expected 0xFF00\n`);
}

// LD HL, SP + e8
function setTest0xF8(value: u8, SpValue: u16): void {
    setTestRom([0xF8, value]);
    Cpu.StackPointer = SpValue;
    Cpu.Tick();
    assert(Cpu.CycleCount == 12);
}

function test0xF8_LD_HL_SP_e8(): void {
    // LD HL, SP + e8
    setTest0xF8(17, 25);
    assert(Cpu.HL == 42, `HL = ${Cpu.HL}, expected 42`);

    setTest0xF8(0x42, 0xFF00);
    assert(Cpu.HL == 0xFF42, `HL = ${Cpu.HL.toString(16)}, expected 0xFF42`);

    setTest0xF8(0x42, 0x00FF);
    assert(Cpu.HL == 0x0141, `HL = ${Cpu.HL.toString(16)}, expected 0x0141`);
}

// LDH [a8], A
function testLDHFromA(target: u8, a: u8): void {
    setTestRom([0xe0, target]);
    Cpu.SetA(a);
    Cpu.Tick();
    assert(Cpu.CycleCount == 12);
}

// LDH A, [a8]
function testLDHToA(source: u8, value: u8): void {
    setTestRom([0xf0, source]);
    const address: u16 = 0xFF00 + <u16>source;
    MemoryMap.GBstore(address, value);
    Cpu.Tick();
    MemoryMap.GBstore(address, 0);
    assert(Cpu.CycleCount == 12);
}

function testLDH(): void {
    testLDHFromA(0x42, 42);
    assert(MemoryMap.GBload<u8>(0xFF42) == 42, `[0xFF42] = ${MemoryMap.GBload<u8>(0xFF42)}. Expected 42`);
    MemoryMap.GBstore<u8>(0xFF42, 0);
    testLDHFromA(0x0, 42);
    assert(MemoryMap.GBload<u8>(0xFF00) == 42, `[0xFF00] = ${MemoryMap.GBload<u8>(0xFF00)}. Expected 42`);
    MemoryMap.GBstore<u8>(0xFF00, 0);

    testLDHToA(0x42, 42);
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);
    testLDHToA(0x00, 42);
    assert(Cpu.A() == 42, `A = ${Cpu.A()}, expected 42`);
}

export function testLD(): boolean {
    testLDRegToReg();
    testLDValueToReg();
    testLDToDeref();
    testLDDerefToReg();
    testLD16bits();
    test0xF8_LD_HL_SP_e8();
    testLDH();
    return true;
}