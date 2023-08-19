import { Cpu } from "../../cpu"
import { MemoryMap } from "../../memoryMap";
import { AF, BC, DE, HL, SP, SetAF, SetBC, SetDE, SetHL, setTestRom } from "../cpuTests";

function RunPush(opCode: u8, sp: u16, source: u16, setSource: (v: u16) => void): void {
    setTestRom([opCode]);
    Cpu.StackPointer = sp;
    setSource(source);
    Cpu.Tick();
    assert(Cpu.CycleCount == 16, `CycleCount = ${Cpu.CycleCount}, expected ${16} (opcode 0x${opCode.toString(16)})`);
}

export function testPush(): boolean {

    RunPush(0xC5, 0xFFFE, 0x42FA, SetBC); // PUSH BC
    assert(SP() == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(MemoryMap.GBload<u16>(0xFFFC) == <u16>0x42FA,
        `[0xFFFC] = 0x${MemoryMap.GBload<u16>(0xFFFC).toString(16)}, expected 0x${BC().toString(16)}`);

    RunPush(0xD5, 0xFFFE, 0x42FA, SetDE); // PUSH DE
    assert(SP() == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(MemoryMap.GBload<u16>(0xFFFC) == <u16>0x42FA,
        `[0xFFFC] = 0x${MemoryMap.GBload<u16>(0xFFFC).toString(16)}, expected 0x${DE().toString(16)}`);

    RunPush(0xE5, 0xFFFE, 0x42FA, SetHL); // PUSH HL
    assert(SP() == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(MemoryMap.GBload<u16>(0xFFFC) == <u16>0x42FA,
        `[0xFFFC] = 0x${MemoryMap.GBload<u16>(0xFFFC).toString(16)}, expected 0x${HL().toString(16)}`);

    RunPush(0xF5, 0xFFFE, 0x42FA, SetAF); // PUSH AF
    assert(SP() == 0xFFFC, `SP = ${SP().toString(16)}, expected 0xFFFC`);
    assert(MemoryMap.GBload<u16>(0xFFFC) == <u16>0x42FA,
        `[0xFFFC] = 0x${MemoryMap.GBload<u16>(0xFFFC).toString(16)}, expected 0x${AF().toString(16)}`);

    return true;
}
