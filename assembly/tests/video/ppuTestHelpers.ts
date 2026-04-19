import { Ppu, PpuMode } from "../../io/video/ppu";
import { Lcd } from "../../io/video/lcd";
import { MemoryMap } from "../../memory/memoryMap";
import { assertEquals } from "../framework";
import { setTestRom } from "../cpuTests";

export function initPpu(): void {
    setTestRom([0x00]);
    // Enable PPU (LCDC bit 7)
    MemoryMap.GBstore<u8>(0xFF40, 0x80);
}

export function tickPpuDots(n: u32): void {
    for (let i: u32 = 0; i < n; i++) {
        Ppu.Tick();
    }
}

export function assertPpuMode(expected: PpuMode, label: string = ""): void {
    assertEquals<u8>(<u8>Ppu.currentMode, <u8>expected,
        label.length > 0 ? label : "ppu mode");
}

export function assertLY(expected: u8, label: string = ""): void {
    assertEquals<u8>(Lcd.data.lY, expected,
        label.length > 0 ? label : "LY");
}

// Check individual STAT bit (bit 0-7)
export function assertStatBit(bit: u8, expected: bool, label: string = ""): void {
    const stat = MemoryMap.GBload<u8>(0xFF41);
    const actual = (stat >> bit) & 1;
    assertEquals<u8>(actual, expected ? 1 : 0,
        label.length > 0 ? label : `STAT bit ${bit}`);
}

// Check interrupt flag register (0xFF0F) for specific IntType bit
export function assertInterruptFlag(intBit: u8, expected: bool, label: string = ""): void {
    const flags = MemoryMap.GBload<u8>(0xFF0F);
    const actual = (flags & intBit) != 0;
    assertEquals<bool>(actual, expected,
        label.length > 0 ? label : `IF bit 0x${intBit.toString(16)}`);
}

export function assertDot(expected: u16, label: string = ""): void {
    assertEquals<u16>(Ppu.currentDot, expected,
        label.length > 0 ? label : "ppu dot");
}
