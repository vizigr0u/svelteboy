import { Cpu } from "../cpu/cpu";
import { Interrupt } from "../cpu/interrupts";
import { Emulator } from "../emulator";
import { Timer } from "../io/timer";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { MemoryMap } from "../memory/memoryMap";
import { describe, it, assertEquals } from "./framework";

function setupNopRom(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Emulator.Init(false);
}

export function testPowerUp(): boolean {
    describe("Power-Up CPU Registers (DMG, no boot ROM)", () => {
        // Spec: A=$01, F=Z=1 N=0, B=$00, C=$13, D=$00, E=$D8, H=$01, L=$4D
        // SP=$FFFE, PC=$0100

        it("A=$01", () => {
            setupNopRom();
            assertEquals<u8>(Cpu.A(), 0x01, "A=$01");
        });

        it("F: Z=1 N=0 (upper nibble = $B0)", () => {
            setupNopRom();
            // $B0 = 1011_0000: Z=1, N=0, H=1, C=1
            assertEquals<u8>(Cpu.F(), 0xB0, "F=$B0 (Z=1 N=0 H=1 C=1)");
        });

        it("B=$00", () => {
            setupNopRom();
            assertEquals<u8>(Cpu.B(), 0x00, "B=$00");
        });

        it("C=$13", () => {
            setupNopRom();
            assertEquals<u8>(Cpu.C(), 0x13, "C=$13");
        });

        it("D=$00", () => {
            setupNopRom();
            assertEquals<u8>(Cpu.D(), 0x00, "D=$00");
        });

        it("E=$D8", () => {
            setupNopRom();
            assertEquals<u8>(Cpu.E(), 0xD8, "E=$D8");
        });

        it("H=$01", () => {
            setupNopRom();
            assertEquals<u8>(Cpu.H(), 0x01, "H=$01");
        });

        it("L=$4D", () => {
            setupNopRom();
            assertEquals<u8>(Cpu.L(), 0x4D, "L=$4D");
        });

        it("SP=$FFFE", () => {
            setupNopRom();
            assertEquals<u16>(Cpu.StackPointer, 0xFFFE, "SP=$FFFE");
        });

        it("PC=$0100", () => {
            setupNopRom();
            assertEquals<u16>(Cpu.ProgramCounter, 0x0100, "PC=$0100");
        });
    });

    describe("Power-Up Hardware Registers (DMG, no boot ROM)", () => {
        it("IF=$E1", () => {
            setupNopRom();
            assertEquals<u8>(Interrupt.Requests(), 0xE1, "IF=$E1");
        });

        it("DIV=$AB (internalDiv upper byte)", () => {
            setupNopRom();
            assertEquals<u8>(Timer.Div, 0xAB, "DIV=$AB");
        });

        it("LCDC=$91", () => {
            setupNopRom();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF40), 0x91, "LCDC=$91");
        });

        it("BGP=$FC", () => {
            setupNopRom();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF47), 0xFC, "BGP=$FC");
        });

        it("P1=$CF (both groups selected, no buttons pressed)", () => {
            setupNopRom();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF00), 0xCF, "P1=$CF");
        });

        it("NR52 bit 7 set (APU on)", () => {
            setupNopRom();
            // Lower nibble = live channel-active flags (dynamic), only test APU-on bit
            assert((MemoryMap.GBload<u8>(0xFF26) & 0x80) != 0, "NR52 bit 7 must be set (APU on)");
        });

        it("NR51=$F3 (channel panning)", () => {
            setupNopRom();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0xF3, "NR51=$F3");
        });

        it("NR50=$77 (volume)", () => {
            setupNopRom();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF24), 0x77, "NR50=$77");
        });
    });

    return true;
}
