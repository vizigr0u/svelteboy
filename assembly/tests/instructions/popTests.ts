import { Cpu } from "../../cpu/cpu";
import { MemoryMap } from "../../memory/memoryMap";
import { AF, BC, DE, HL, SP, setTestRom } from "../cpuTests";
import { describe, it, assertEquals, assertCycles } from "../framework";

function RunPop(opCode: u8, sp: u16, source: u16): void {
    setTestRom([opCode]);
    MemoryMap.GBstore<u16>(sp, source);
    Cpu.StackPointer = sp;
    Cpu.Tick();
    assertCycles(12);
}

export function testPop(): boolean {
    describe("POP", () => {
        it("POP BC", () => {
            RunPop(0xC1, 0xFFFC, 0x42FA);
            assertEquals<u16>(SP(), 0xFFFE, "SP");
            assertEquals<u16>(BC(), 0x42FA, "BC");
        });
        it("POP DE", () => {
            RunPop(0xD1, 0xFFFC, 0x42FA);
            assertEquals<u16>(SP(), 0xFFFE, "SP");
            assertEquals<u16>(DE(), 0x42FA, "DE");
        });
        it("POP HL", () => {
            RunPop(0xE1, 0xFFFC, 0x42FA);
            assertEquals<u16>(SP(), 0xFFFE, "SP");
            assertEquals<u16>(HL(), 0x42FA, "HL");
        });
        it("POP AF (lower F bits masked)", () => {
            RunPop(0xF1, 0xFFFC, 0x42FA);
            assertEquals<u16>(SP(), 0xFFFE, "SP");
            assertEquals<u16>(AF(), 0x42F0, "AF"); // lower nibble of F always 0
        });
    });
    return true;
}
