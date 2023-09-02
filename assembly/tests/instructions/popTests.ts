import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { AF, BC, DE, HL, SP, setTestRom } from "../cpuTests";

function RunPop(opCode: u8, sp: u16, source: u16): void {
    setTestRom([opCode]);
    MemoryMap.GBstore<u16>(sp, source);
    Cpu.StackPointer = sp;
    Cpu.Tick();
    assert(Cpu.CycleCount == 12, `CycleCount = ${Cpu.CycleCount}, expected ${16} (opcode 0x${opCode.toString(16)})`);
}

export function testPop(): boolean {

    RunPop(0xC1, 0xFFFC, 0x42FA); // POP BC
    assert(SP() == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(BC() == 0x42FA, `BC = 0x${BC().toString(16)}, expected 0x42FA`);

    RunPop(0xD1, 0xFFFC, 0x42FA); // POP DE
    assert(SP() == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(DE() == 0x42FA, `DE = 0x${DE().toString(16)}, expected 0x42FA`);

    RunPop(0xE1, 0xFFFC, 0x42FA); // POP HL
    assert(SP() == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(HL() == 0x42FA, `HL = 0x${HL().toString(16)}, expected 0x42FA`);

    RunPop(0xF1, 0xFFFC, 0x42FA); // POP AF
    assert(SP() == 0xFFFE, `SP = ${SP().toString(16)}, expected 0xFFFE`);
    assert(AF() == 0x42F0, `AF = 0x${AF().toString(16)}, expected 0x42F0`); // lower bits of F shouldn't be set!

    return true;
}
