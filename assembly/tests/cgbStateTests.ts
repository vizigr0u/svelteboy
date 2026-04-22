import { Cartridge } from "../cartridge";
import { Cpu } from "../cpu/cpu";
import { Emulator } from "../emulator";
import { Timer } from "../io/timer";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { MemoryMap } from "../memory/memoryMap";
import { CGBMode } from "../metadata";
import { CgbState } from "../cgbState";
import { describe, it, assertEquals } from "./framework";

function setupRom(cgbFlag: u8): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, cgbFlag);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Cartridge.Data.cgbFlag = cgbFlag;
}

function testCgbStateToggle(): void {
    describe("cgbState", () => {
        it("defaults false", () => {
            CgbState.setIsCGB(false);
            assertEquals<boolean>(CgbState.isCgbMode, false, "isCgbMode default");
        });

        it("setIsCGB true", () => {
            CgbState.setIsCGB(true);
            assertEquals<boolean>(CgbState.isCgbMode, true, "setIsCGB(true)");
            CgbState.setIsCGB(false);
        });
    });
}

function testDmgInit(): void {
    describe("DMG init (NonCGB)", () => {
        it("CPU registers are DMG power-on values", () => {
            setupRom(0x00);
            Emulator.Init(false);
            assertEquals<boolean>(CgbState.isCgbMode, false, "isCgbMode");
            assertEquals<u16>(Cpu.AF, 0x01B0, "AF");
            assertEquals<u16>(Cpu.BC, 0x0013, "BC");
            assertEquals<u16>(Cpu.DE, 0x00D8, "DE");
            assertEquals<u16>(Cpu.HL, 0x014D, "HL");
        });

        it("Timer internalDiv is DMG value", () => {
            setupRom(0x00);
            Emulator.Init(false);
            assertEquals<u16>(Timer.internalDiv, 0xAC00, "internalDiv DMG");
            assertEquals<u8>(Timer.Tac, 0x00, "TAC DMG");
        });
    });
}

function testCgbInit(): void {
    describe("CGB init (CGBOnly)", () => {
        it("CPU registers are CGB power-on values", () => {
            setupRom(CGBMode.CGBOnly as u8);
            Emulator.Init(false);
            assertEquals<boolean>(CgbState.isCgbMode, true, "isCgbMode");
            assertEquals<u16>(Cpu.AF, 0x1180, "AF");
            assertEquals<u16>(Cpu.BC, 0x0000, "BC");
            assertEquals<u16>(Cpu.DE, 0xFF56, "DE");
            assertEquals<u16>(Cpu.HL, 0x000D, "HL");
        });

        it("Timer internalDiv is CGB value", () => {
            setupRom(CGBMode.CGBOnly as u8);
            Emulator.Init(false);
            assertEquals<u16>(Timer.internalDiv, 0xABCC, "internalDiv CGB");
            assertEquals<u8>(Timer.Tac, 0xF8, "TAC CGB");
        });
    });
}

function testPartialCgbInit(): void {
    describe("CGB init (PartialCGB)", () => {
        it("detected as CGB mode", () => {
            setupRom(CGBMode.PartialCGB as u8);
            Emulator.Init(false);
            assertEquals<boolean>(CgbState.isCgbMode, true, "isCgbMode PartialCGB");
        });
    });
}

export function testCgbState(): boolean {
    testCgbStateToggle();
    testDmgInit();
    testCgbInit();
    testPartialCgbInit();
    Cartridge.Data.cgbFlag = 0x00;
    CgbState.setIsCGB(false);
    return true;
}
