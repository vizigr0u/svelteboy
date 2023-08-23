import { Cpu } from "../cpu/cpu";
import { GB_VIDEO_START, GB_VIDEO_SIZE } from "../cpu/memoryConstants";
import { SP, setTestRom } from "./cpuTests";

function testFirstProgram(): void {
    // first bits of DMG boot rom: setup SP and clear VRAM (0x8000->0x9FFF)
    setTestRom([0x31, 0xFE, 0xFF, 0xAF, 0x21, 0xFF, 0x9F, 0x32, 0xCB, 0x7C, 0x20, 0xFB]);
    // fill video mem with 0x42 to see that the program cleared it
    memory.fill(GB_VIDEO_START, 0x42, GB_VIDEO_SIZE);
    for (let i = 0; Cpu.ProgramCounter != 0x000c; i++) {
        Cpu.Tick();
    }
    for (let i: u16 = 0; i < 0x2005; ++i) {
        assert(load<u8>(GB_VIDEO_START + i) == (i >= 0x2000 ? 0x42 : 0x0),
            `[0x${(i + 0x8000).toString(16)}] = 0x${load<u8>(GB_VIDEO_START + i).toString(16)}`);
    }
    assert(SP() == 0xFFFE, `SP = 0x${SP()}, expected 0xFFFE`);
}

export function testPrograms(): boolean {
    testFirstProgram();
    return true;
}
