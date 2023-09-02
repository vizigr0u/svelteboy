import { Cpu } from "../cpu/cpu";
import { IntType, Interrupt } from "../cpu/interrupts";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { MemoryMap } from "../memory/memoryMap";
import { Emulator } from "../emulator";

function setIntProgram(int: IntType, instructions: Array<u8>): void {
    const intGbAddress: u16 = Interrupt.GetHandlerAddress(int);
    memory.copy(CARTRIDGE_ROM_START + intGbAddress, instructions.dataStart, instructions.length);
}

function setupRomProgram(instructions: Array<u8>): void {
    memory.fill(CARTRIDGE_ROM_START, 0, 0x100);
    memory.copy(CARTRIDGE_ROM_START + 0x100, instructions.dataStart, instructions.length);
    MemoryMap.loadedCartridgeRomSize = instructions.length;
    Emulator.Init(false);
}

function testInt1(): void {
    // first bits of DMG boot rom: setup SP and clear VRAM (0x8000->0x9FFF)
    setupRomProgram([
        0x3E, 0x04,         // LD A, $04
        0xE0, 0xFF,         // LDH [$FF], A  => IE = 04 (Timer int)
        0xFB,               // EI
        0x01, 0x00, 0x00,   // LD BC 0
        0xC5,               // PUSH BC
        0xC1,               // POP BC
        0x04,               // INC B
        0x3E, 0x04,         // LD A, $04
        0xE0, 0x0F,         // LDH [$0F], A  => IF = 04 (Timer int)
        0x00]);
    setIntProgram(IntType.Timer, [
        0x3C, // inc A
        0xC9  // ret
    ]);
    for (let i = 0; Cpu.ProgramCounter != 0x0010; i++) {
        Cpu.Tick();
    }
    console.log(`A = ${Cpu.A()}`)
}

export function testInterrupts(): boolean {
    testInt1();
    return true;
}
