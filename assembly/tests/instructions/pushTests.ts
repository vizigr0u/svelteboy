import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { AF, BC, DE, HL, SP, SetAF, SetBC, SetDE, SetHL, setTestRom } from "../cpuTests";
import { describe, it, assertEquals, assertCycles } from "../framework";

function RunPush(opCode: u8, sp: u16, source: u16, setSource: (v: u16) => void): void {
    setTestRom([opCode]);
    Cpu.StackPointer = sp;
    setSource(source);
    Cpu.Tick();
    assertCycles(16);
}

export function testPush(): boolean {
    describe("PUSH", () => {
        it("PUSH BC", () => {
            RunPush(0xC5, 0xFFFE, 0x42FA, SetBC);
            assertEquals<u16>(SP(), 0xFFFC, "SP");
            assertEquals<u16>(MemoryMap.GBload<u16>(0xFFFC), 0x42FA, "[SP]");
        });
        it("PUSH DE", () => {
            RunPush(0xD5, 0xFFFE, 0x42FA, SetDE);
            assertEquals<u16>(SP(), 0xFFFC, "SP");
            assertEquals<u16>(MemoryMap.GBload<u16>(0xFFFC), 0x42FA, "[SP]");
        });
        it("PUSH HL", () => {
            RunPush(0xE5, 0xFFFE, 0x42FA, SetHL);
            assertEquals<u16>(SP(), 0xFFFC, "SP");
            assertEquals<u16>(MemoryMap.GBload<u16>(0xFFFC), 0x42FA, "[SP]");
        });
        it("PUSH AF", () => {
            RunPush(0xF5, 0xFFFE, 0x42FA, SetAF);
            assertEquals<u16>(SP(), 0xFFFC, "SP");
            assertEquals<u16>(MemoryMap.GBload<u16>(0xFFFC), 0x42FA, "[SP]");
        });
    });
    return true;
}
