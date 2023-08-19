import { Cpu } from "../cpu"
import { getMnemonicName } from "../disassemble";
import { Emulator } from "../emulator";
import { Interrupt } from "../interrupts";
import { BOOT_ROM_START, MemoryMap } from "../memoryMap";
import { Instruction, Op, prefixedOpCodes, unprefixedOpCodes } from "../opcodes";

const testedOpcodes: Set<u8> = new Set<u8>();
const testedPrefixedOpcodes: Set<u8> = new Set<u8>();
const allOps: Map<Op, u32> = new Map<Op, u32>();

export function resetCpuTestSession(): void {
    testedOpcodes.clear();
    testedPrefixedOpcodes.clear();
}

function gatherTestedOps(opCodesSet: Set<u8>, instructions: StaticArray<Instruction>, testedOps: Map<Op, u32>, untestedOps: Set<Op>): void {
    const testedOpcodeArray = opCodesSet.values();
    for (let i = 0; i < testedOpcodeArray.length; i++) {
        const opCode = testedOpcodeArray[i];
        const mnemonic = instructions[opCode].mnemonic;
        testedOps.set(mnemonic, testedOps.has(mnemonic) ? testedOps.get(mnemonic) + 1 : 1);
    }

    for (let i = 0; i < instructions.length; i++) {
        const op = instructions[i];
        allOps.set(op.mnemonic, allOps.has(op.mnemonic) ? allOps.get(op.mnemonic) + 1 : 1);
        if (!testedOps.has(op.mnemonic))
            untestedOps.add(op.mnemonic);
    }
}

export function getCpuTestSessionSummary(): string {
    let s: string = "";
    const illegalOpsCount = 11;
    const maxTestCount = 512 - illegalOpsCount;
    const numStandard = testedOpcodes.size;
    const numPrefixed = testedPrefixedOpcodes.size;
    const totalTested = numStandard + testedPrefixedOpcodes.size;
    s += `tested opcodes: ${totalTested}/${maxTestCount} (${numStandard}/${256 - illegalOpsCount} + ${numPrefixed}/256) = ${(100 * totalTested / maxTestCount)}%`;


    const testedOps: Map<Op, u32> = new Map<Op, u32>();
    const untestedOps: Set<Op> = new Set<Op>();
    gatherTestedOps(testedOpcodes, unprefixedOpCodes, testedOps, untestedOps);
    gatherTestedOps(testedPrefixedOpcodes, prefixedOpCodes, testedOps, untestedOps);

    s += "\ntested Mnemonics:";
    const testedOpsArray = testedOps.keys();
    for (let i = 0; i < testedOpsArray.length; i++) {
        const op = testedOpsArray[i];
        s += getMnemonicName(op) + `(${testedOps.get(op)}/${allOps.get(op)})`;
        if (i < testedOpsArray.length - 1)
            s += ", ";
    }

    s += "\nUNTESTED Mnemonics:";
    const untestedOpsArray = untestedOps.values();
    untestedOpsArray.sort((a, b) => allOps.get(b) - allOps.get(a));
    for (let i = 0; i < untestedOpsArray.length; i++) {
        const op = untestedOpsArray[i];
        if (op == Op.ILLEGAL)
            continue;
        s += getMnemonicName(op) + `(${allOps.get(op)})`;
        if (i < untestedOpsArray.length - 1)
            s += ", ";
    }

    s += '\nTODO: more details about prefixed';

    return s;
}

export function setTestRom(instructions: Array<u8>): void {
    testedOpcodes.add(instructions[0]);
    if (instructions[0] == 0xCB)
        testedPrefixedOpcodes.add(instructions[1]);
    memory.copy(BOOT_ROM_START, instructions.dataStart, instructions.length);
    MemoryMap.loadedBootRomSize = instructions.length;
    Emulator.Init(true);
}

// useful to pass as lambdas to tests
export function SetAF(value: u16): void {
    Cpu.AF = value;
}
export function SetBC(value: u16): void {
    Cpu.BC = value;
}
export function SetDE(value: u16): void {
    Cpu.DE = value;
}
export function SetHL(value: u16): void {
    Cpu.HL = value;
}
export function SetSP(value: u16): void {
    Cpu.StackPointer = value;
}
export function SetPC(value: u16): void {
    Cpu.ProgramCounter = value;
}

export function AF(): u16 {
    return Cpu.AF;
}
export function BC(): u16 {
    return Cpu.BC;
}
export function DE(): u16 {
    return Cpu.DE;
}
export function HL(): u16 {
    return Cpu.HL;
}
export function SP(): u16 {
    return Cpu.StackPointer;
}
export function PC(): u16 {
    return Cpu.ProgramCounter;
}

function testEi(): void {
    setTestRom([0xFB, 0x00]);
    Interrupt.masterEnabled = false;
    Cpu.Tick();
    assert(Interrupt.masterEnabled);
    assert(Cpu.CycleCount == 4, `Cycles = ${Cpu.CycleCount}, expected 8`);
}

function testDi(): void {
    setTestRom([0xF3]);
    Interrupt.masterEnabled = true;
    Cpu.Tick();
    assert(!Interrupt.masterEnabled);
    assert(Cpu.CycleCount == 4, `Cycles = ${Cpu.CycleCount}, expected 4`);
}

function testHalt(): void {
    setTestRom([0x76, 0x00,]);
    Cpu.Tick();
    assert(Cpu.isHalted);
    assert(Cpu.CycleCount == 4, `Cycles = ${Cpu.CycleCount}, expected 4`);
}

function testNops(n: i32): void {
    setTestRom(new Array<u8>(n).fill(0x00));
    const oldPC = Cpu.ProgramCounter;
    for (let i = 0; i < n; i++) {
        Cpu.Tick();
    }
    assert(Cpu.CycleCount == n * 4, `Cycles = ${Cpu.CycleCount}, expected ${n * 4}`);
    assert(Cpu.ProgramCounter = oldPC + <u16>n);
}

export function testNop(): boolean {
    testNops(2);
    testNops(10);
    testNops(1000);
    return true;
}

function testStack(): boolean {
    Cpu.StackPointer = 0xFFFE;
    Cpu.PushToSP(0x42FA);
    assert(Cpu.StackPointer == 0xFFFC, `SP = ${Cpu.StackPointer} but expected 0xFFFC`);
    const popped: u16 = Cpu.PopSP();
    assert(Cpu.StackPointer == 0xFFFE, `SP = ${Cpu.StackPointer} but expected 0xFFFE`);
    assert(popped == 0x42FA, `popped = ${popped} but expected 0x42FA`);
    return true;
}

export function testCpu(): boolean {
    testEi();
    testDi();
    testHalt();
    testStack();

    return true;
}
