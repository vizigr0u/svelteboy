import { CgbState } from "../cgbState";
import { Emulator } from "../emulator";
import { WramBank } from "../io/wramBank";
import { MemoryMap } from "../memory/memoryMap";
import { GB_WRAM_BANK_SIZE, GB_WRAM_START, CARTRIDGE_ROM_START } from "../memory/memoryConstants";
import { CGBMode } from "../metadata";
import { Cartridge } from "../cartridge";
import { describe, it, assertEquals } from "./framework";

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

function testSVBKRegister(): void {
    describe("SVBK register (FF70)", () => {
        it("defaults to bank 1 after CGB init", () => {
            setupCGB();
            assertEquals<u32>(WramBank.bank, 1, "default bank");
        });

        it("Load returns bank | 0xF8", () => {
            setupCGB();
            WramBank.Store(2);
            assertEquals<u8>(WramBank.Load(), 0xFA, "Load bank 2 = 0xFA");
        });

        it("Store 0 maps to bank 1 (0 forbidden)", () => {
            setupCGB();
            WramBank.Store(0);
            assertEquals<u32>(WramBank.bank, 1, "bank 0 -> 1");
        });

        it("Store 1-7 selects that bank", () => {
            setupCGB();
            for (let b: u8 = 1; b <= 7; b++) {
                WramBank.Store(b);
                assertEquals<u32>(WramBank.bank, <u32>b, "bank " + b.toString());
            }
        });

        it("Store only uses low 3 bits", () => {
            setupCGB();
            WramBank.Store(0xFF);
            assertEquals<u32>(WramBank.bank, 7, "0xFF -> bank 7");
        });

        it("Handles only in CGB mode", () => {
            setupCGB();
            assertEquals<boolean>(WramBank.Handles(0xFF70), true, "CGB handles FF70");
            setupDMG();
            assertEquals<boolean>(WramBank.Handles(0xFF70), false, "DMG ignores FF70");
        });
    });
}

function testWRAMBanking(): void {
    describe("WRAM bank switching via GBToMemory", () => {
        it("0xC000-0xCFFF always maps to bank 0 (fixed)", () => {
            setupCGB();
            const addr0C: u32 = MemoryMap.GBToMemory(0xC000);
            assertEquals<u32>(addr0C, GB_WRAM_START, "0xC000 = WRAM base");
        });

        it("0xD000-0xDFFF maps to selected bank offset", () => {
            setupCGB();
            WramBank.Store(2);
            const addr0D: u32 = MemoryMap.GBToMemory(0xD000);
            assertEquals<u32>(addr0D, GB_WRAM_START + 2 * GB_WRAM_BANK_SIZE, "0xD000 bank2 = WRAM + 0x2000");
        });

        it("0xD000 bank 1 maps to WRAM + 0x1000", () => {
            setupCGB();
            WramBank.Store(1);
            const addr: u32 = MemoryMap.GBToMemory(0xD000);
            assertEquals<u32>(addr, GB_WRAM_START + GB_WRAM_BANK_SIZE, "0xD000 bank1 = WRAM + 0x1000");
        });

        it("0xD000 bank 7 maps to WRAM + 7*0x1000", () => {
            setupCGB();
            WramBank.Store(7);
            const addr: u32 = MemoryMap.GBToMemory(0xD000);
            assertEquals<u32>(addr, GB_WRAM_START + 7 * GB_WRAM_BANK_SIZE, "0xD000 bank7");
        });

        it("DMG: 0xD000 maps fixed (no banking)", () => {
            setupDMG();
            const addr: u32 = MemoryMap.GBToMemory(0xD000);
            assertEquals<u32>(addr, GB_WRAM_START + 0x1000, "DMG 0xD000 = WRAM+0x1000");
        });

        it("bank isolation: write to bank 2, read back from bank 2 only", () => {
            setupCGB();
            WramBank.Store(2);
            MemoryMap.GBstore<u8>(0xD000, 0xAB);
            WramBank.Store(3);
            MemoryMap.GBstore<u8>(0xD000, 0xCD);

            WramBank.Store(2);
            assertEquals<u8>(MemoryMap.GBload<u8>(0xD000), 0xAB, "bank2 data");
            WramBank.Store(3);
            assertEquals<u8>(MemoryMap.GBload<u8>(0xD000), 0xCD, "bank3 data");
        });
    });
}

export function testWramBank(): boolean {
    testSVBKRegister();
    testWRAMBanking();
    CgbState.setIsCGB(false);
    CgbState.setWramBank(1);
    return true;
}
