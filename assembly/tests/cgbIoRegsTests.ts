import { Cartridge } from "../cartridge";
import { Emulator } from "../emulator";
import { IO } from "../io/io";
import { MemoryMap } from "../memory/memoryMap";
import { CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { CGBMode } from "../metadata";
import { CgbState } from "../cgbState";
import { describe, it, assertEquals } from "./framework";

const KEY0: u16 = 0xFF4C;
const RP: u16 = 0xFF56;
const OPRI: u16 = 0xFF6C;
const FF72: u16 = 0xFF72;
const FF73: u16 = 0xFF73;
const FF74: u16 = 0xFF74;
const FF75: u16 = 0xFF75;
const PCM12: u16 = 0xFF76;
const PCM34: u16 = 0xFF77;

function setupCGB(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, CGBMode.CGBOnly as u8);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Cartridge.Data.cgbFlag = CGBMode.CGBOnly as u8;
    Emulator.Init(false);
}

function setupDMG(): void {
    memory.fill(CARTRIDGE_ROM_START, 0x00, 0x8000);
    store<u8>(CARTRIDGE_ROM_START + 0x143, 0x00);
    MemoryMap.loadedCartridgeRomSize = 0x8000;
    Cartridge.Data.cgbFlag = 0x00;
    Emulator.Init(false);
}

function testRP(): void {
    describe("RP register ($FF56)", () => {
        it("idle read: bits 7-6 = 0, bit 1 = 1, bit 0 = 0, unused = 1 (== 0x3E)", () => {
            setupCGB();
            assertEquals<u8>(IO.Load(RP), 0x3E, "RP idle");
        });

        it("write emit bit (bit 0) reflected in read", () => {
            setupCGB();
            IO.Store(RP, 0x01);
            assertEquals<u8>(IO.Load(RP), 0x3F, "RP emit on");
        });

        it("write read-enable (bits 7-6 = 11) reflected in read, bit 1 stays 1 (no IR peer)", () => {
            setupCGB();
            IO.Store(RP, 0xC0);
            assertEquals<u8>(IO.Load(RP), 0xFE, "RP read enabled");
        });

        it("writes clear unused bits 5-2 in stored value but reads see them as 1", () => {
            setupCGB();
            IO.Store(RP, 0xFF);
            assertEquals<u8>(IO.Load(RP), 0xFF, "RP wrote all bits");
            IO.Store(RP, 0x00);
            assertEquals<u8>(IO.Load(RP), 0x3E, "RP wrote zero");
        });

        it("DMG mode: reads 0xFF (reg does not exist)", () => {
            setupDMG();
            assertEquals<u8>(IO.Load(RP), 0xFF, "RP DMG");
        });
    });
}

function testOPRI(): void {
    describe("OPRI register ($FF6C)", () => {
        it("default after CGB init: bit 0 = 0 (CGB priority), unused bits = 1 (== 0xFE)", () => {
            setupCGB();
            assertEquals<u8>(IO.Load(OPRI), 0xFE, "OPRI default");
        });

        it("write bit 0 = 1 selects DMG priority, read returns 0xFF", () => {
            setupCGB();
            IO.Store(OPRI, 0x01);
            assertEquals<u8>(IO.Load(OPRI), 0xFF, "OPRI DMG priority");
        });

        it("only bit 0 is persisted", () => {
            setupCGB();
            IO.Store(OPRI, 0xFE);
            assertEquals<u8>(IO.Load(OPRI), 0xFE, "OPRI upper bits dropped");
        });

        it("DMG mode: reads 0xFF", () => {
            setupDMG();
            assertEquals<u8>(IO.Load(OPRI), 0xFF, "OPRI DMG");
        });
    });
}

function testFF72FF73(): void {
    describe("Undocumented $FF72/$FF73 (fully R/W, CGB)", () => {
        it("$FF72 stores all 8 bits", () => {
            setupCGB();
            IO.Store(FF72, 0xA5);
            assertEquals<u8>(IO.Load(FF72), 0xA5, "FF72 wrote A5");
            IO.Store(FF72, 0x00);
            assertEquals<u8>(IO.Load(FF72), 0x00, "FF72 wrote 00");
        });

        it("$FF73 stores all 8 bits", () => {
            setupCGB();
            IO.Store(FF73, 0x5A);
            assertEquals<u8>(IO.Load(FF73), 0x5A, "FF73 wrote 5A");
        });

        it("default after CGB init is 0x00", () => {
            setupCGB();
            assertEquals<u8>(IO.Load(FF72), 0x00, "FF72 init");
            assertEquals<u8>(IO.Load(FF73), 0x00, "FF73 init");
        });

        it("DMG mode: reads 0xFF", () => {
            setupDMG();
            assertEquals<u8>(IO.Load(FF72), 0xFF, "FF72 DMG");
            assertEquals<u8>(IO.Load(FF73), 0xFF, "FF73 DMG");
        });
    });
}

function testFF74(): void {
    describe("Undocumented $FF74 (R/W in CGB, else read-only 0xFF)", () => {
        it("CGB: R/W", () => {
            setupCGB();
            IO.Store(FF74, 0x3C);
            assertEquals<u8>(IO.Load(FF74), 0x3C, "FF74 R/W");
        });

        it("DMG: reads 0xFF, writes ignored", () => {
            setupDMG();
            assertEquals<u8>(IO.Load(FF74), 0xFF, "FF74 DMG");
            IO.Store(FF74, 0x00);
            assertEquals<u8>(IO.Load(FF74), 0xFF, "FF74 DMG after write");
        });
    });
}

function testFF75(): void {
    describe("Undocumented $FF75 (bits 4-6 R/W, others read as 1)", () => {
        it("default reads 0x8F (bits 4-6 = 0, unused = 1)", () => {
            setupCGB();
            assertEquals<u8>(IO.Load(FF75), 0x8F, "FF75 init");
        });

        it("only bits 4-6 persist; read merges with unused=1", () => {
            setupCGB();
            IO.Store(FF75, 0xFF);
            assertEquals<u8>(IO.Load(FF75), 0xFF, "FF75 wrote FF");
            IO.Store(FF75, 0x70);
            assertEquals<u8>(IO.Load(FF75), 0xFF, "FF75 wrote 70");
            IO.Store(FF75, 0x00);
            assertEquals<u8>(IO.Load(FF75), 0x8F, "FF75 wrote 00");
            IO.Store(FF75, 0x0F);
            assertEquals<u8>(IO.Load(FF75), 0x8F, "FF75 wrote 0F (low bits dropped)");
        });

        it("DMG mode: reads 0xFF", () => {
            setupDMG();
            assertEquals<u8>(IO.Load(FF75), 0xFF, "FF75 DMG");
        });
    });
}

function testPCM12_34(): void {
    describe("PCM12/PCM34 ($FF76/$FF77) [R]", () => {
        it("CGB silent: reads 0x00 (not 0xFF)", () => {
            setupCGB();
            assertEquals<u8>(IO.Load(PCM12), 0x00, "PCM12 silent");
            assertEquals<u8>(IO.Load(PCM34), 0x00, "PCM34 silent");
        });

        it("writes are no-ops (read-only registers)", () => {
            setupCGB();
            IO.Store(PCM12, 0xAA);
            IO.Store(PCM34, 0xBB);
            assertEquals<u8>(IO.Load(PCM12), 0x00, "PCM12 no write");
            assertEquals<u8>(IO.Load(PCM34), 0x00, "PCM34 no write");
        });

        it("DMG mode: reads 0xFF (regs do not exist)", () => {
            setupDMG();
            assertEquals<u8>(IO.Load(PCM12), 0xFF, "PCM12 DMG");
            assertEquals<u8>(IO.Load(PCM34), 0xFF, "PCM34 DMG");
        });
    });
}

function testKEY0(): void {
    describe("KEY0 register ($FF4C)", () => {
        it("CGB with boot ROM active: writes stored", () => {
            setupCGB();
            MemoryMap.useBootRom = true;
            IO.Store(KEY0, 0x04);
            assertEquals<u8>(IO.Load(KEY0), 0x04, "KEY0 bit2 set");
            MemoryMap.useBootRom = false;
        });

        it("CGB with boot ROM disabled: writes ignored (locked)", () => {
            setupCGB();
            MemoryMap.useBootRom = false;
            IO.Store(KEY0, 0x04);
            assertEquals<u8>(IO.Load(KEY0), 0x00, "KEY0 locked");
        });

        it("write to $FF50 locks KEY0 for subsequent writes", () => {
            setupCGB();
            MemoryMap.useBootRom = true;
            IO.Store(KEY0, 0x04);
            assertEquals<u8>(IO.Load(KEY0), 0x04, "KEY0 before lock");
            IO.Store(0xFF50, 0x01); // disable boot ROM
            IO.Store(KEY0, 0x00);
            assertEquals<u8>(IO.Load(KEY0), 0x04, "KEY0 locked after FF50");
        });

        it("DMG mode: reads 0xFF", () => {
            setupDMG();
            assertEquals<u8>(IO.Load(KEY0), 0xFF, "KEY0 DMG");
        });
    });
}

export function testCgbIoRegs(): boolean {
    testRP();
    testOPRI();
    testFF72FF73();
    testFF74();
    testFF75();
    testPCM12_34();
    testKEY0();
    Cartridge.Data.cgbFlag = 0x00;
    CgbState.setIsCGB(false);
    MemoryMap.useBootRom = false;
    return true;
}
