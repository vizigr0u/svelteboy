import { Logger, log } from "../debug/logger";
import { IO } from "../io/io";
import { Oam } from "../io/video/oam";
import { uToHex } from "../utils/stringUtils";

export const MEMORY_START: u32 = 0x00;

export const FIFO_START: u32 = MEMORY_START;
export const FIFO_MAX_ELEMENTS: u8 = 10;
export const FIFOS_SIZE: u32 = <u32>FIFO_MAX_ELEMENTS + 2; // head and tail indices

// space for all in-console memory - https://gbdev.io/pandocs/Memory_Map.html

export const GB_VIDEO_START: u32 = FIFO_START + FIFOS_SIZE;
export const GB_VIDEO_BANK_SIZE: u32 = 0x2000;
export const GB_VIDEO_SIZE: u32 = 2 * GB_VIDEO_BANK_SIZE; // 1 + 1 bank (CGB)

export const GB_OAM_START: u32 = GB_VIDEO_START + GB_VIDEO_SIZE;
export const GB_OAM_SIZE: u32 = 0x00a0;

export const GB_RAM_START: u32 = GB_OAM_START + GB_OAM_SIZE;
export const GB_RAM_BANK_SIZE: u32 = 0x1000;
export const GB_RAM_SIZE: u32 = 8 * GB_RAM_BANK_SIZE; // 1 + up to 7 additional banks (CGB)

export const GB_IO_START: u32 = GB_RAM_START + GB_RAM_SIZE;
export const GB_IO_SIZE: u32 = 0x0080;

export const GB_HIGH_RAM_START: u32 = GB_IO_START + GB_IO_SIZE;
export const GB_HIGH_RAM_SIZE: u32 = 0x0080;

// address returned for restricted areas

export const GB_RESTRICTED_AREA_ADDRESS: u32 = GB_HIGH_RAM_START + GB_HIGH_RAM_SIZE;
export const GB_RESTRICTED_AREA_SIZE: u32 = 4;

export const GB_MEMORY_END: u32 = GB_RESTRICTED_AREA_ADDRESS + GB_RESTRICTED_AREA_SIZE;

// space to store Roms: boot rom and cartridge

export const BOOT_ROM_START: u32 = GB_MEMORY_END;
export const BOOT_ROM_SIZE: u32 = 0xa00; // largest known supported bios

export const ROM_BANK_SIZE: u32 = 0x4000;
export const CARTRIDGE_ROM_START: u32 = BOOT_ROM_START + BOOT_ROM_SIZE;
export const CARTRIDGE_ROM_SIZE: u32 = 0x7e0400; // largest supported rom = 8MB

export const ROM_STORAGE_END: u32 = CARTRIDGE_ROM_START + CARTRIDGE_ROM_SIZE;

// some space for running tests

export const TEST_SPACE_START: u32 = ROM_STORAGE_END;
export const TEST_SPACE_END: u32 = TEST_SPACE_START + 0x8000;

// end of memory

export const TOTAL_MEMORY_SIZE: u32 = TEST_SPACE_END;

export const MEMORY_PAGE_SIZE: u32 = TOTAL_MEMORY_SIZE / 1024 / 64;

// grab enough memory pages ASAP
const dif = MEMORY_PAGE_SIZE - memory.size();
if (dif > 0) {
    memory.grow(dif);
}

@final
export class MemoryMap {
    static useBootRom: boolean = false;
    static currentRomBankIndex: u8 = 0;
    static currentVideoBankIndex: u8 = 0; // CGB
    static currentRamBankIndex: u8 = 0;
    static loadedBootRomSize: u32 = 0;
    static loadedCartridgeRomSize: u32 = 0;

    static Init(useBootRom: boolean = true): void {
        if (Logger.verbose >= 1)
            log('Initialized MemoryMap, using boot : ' + useBootRom.toString());
        MemoryMap.useBootRom = useBootRom;
        MemoryMap.currentRomBankIndex = 0;
        MemoryMap.currentRamBankIndex = 0;
        MemoryMap.currentVideoBankIndex = 0; // CGB
    }

    static GBToMemory(gbAddress: u16): u32 {
        const hiByte: u8 = <u8>(gbAddress >> 12);
        switch (hiByte) {
            case 0x0:
                if (MemoryMap.useBootRom && gbAddress <= 0x100)
                    return BOOT_ROM_START + gbAddress;
            case 0x1:
            case 0x2:
            case 0x3:
                return CARTRIDGE_ROM_START + gbAddress;
            case 0x4:
            case 0x5:
            case 0x6:
            case 0x7:
                return CARTRIDGE_ROM_START + gbAddress + MemoryMap.currentRomBankIndex * ROM_BANK_SIZE;
            case 0x8:
            case 0x9:
                return GB_VIDEO_START + gbAddress - 0x8000 + MemoryMap.currentVideoBankIndex * GB_VIDEO_BANK_SIZE;
            case 0xA:
            case 0xB:
                return GB_RAM_START + gbAddress - 0xA000;
            case 0xC:
            case 0xD:
                return GB_RAM_START + gbAddress - 0xA000 + MemoryMap.currentRamBankIndex * GB_RAM_BANK_SIZE;
            case 0xE:
            case 0xF:
                if (gbAddress < 0xFF80)
                    return GB_IO_START + gbAddress - 0xFF00;
                return GB_HIGH_RAM_START + gbAddress - 0xFF80;
            default:
                assert(false, `(?!) unmapped address: ${uToHex<u16>(gbAddress)} (hibyte: ${uToHex<u8>(hiByte)})`);
        }
        assert(false);
        return GB_RESTRICTED_AREA_ADDRESS;
    }

    static GBload<T>(gbAddress: u16): T {
        if (gbAddress >= 0xE000 && gbAddress < 0xFE00) {
            if (Logger.verbose >= 3)
                log(`Unexpected hit in echo RAM: ${uToHex<u16>(gbAddress)}`);
            return <T>0;
        }
        if (Oam.Handles(gbAddress)) {
            return Oam.Load<T>(gbAddress);
        }
        if (gbAddress >= 0xFEA0 && gbAddress < 0xFF00) {
            if (Logger.verbose >= 3)
                log('Unexpected read in restricted area');
            return <T>0;
        }
        if (IO.Handles(gbAddress)) {
            return <T>(IO.Load(gbAddress));
        }
        return load<T>(MemoryMap.GBToMemory(gbAddress));
    }

    static GBstore<T>(gbAddress: u16, value: T): void {
        if (gbAddress >= 0xE000 && gbAddress < 0xFE00) {
            if (Logger.verbose >= 2)
                log('Unexpected write in echo RAM');
            return;
        }
        if (Oam.Handles(gbAddress)) {
            Oam.Store<T>(gbAddress, value);
            return;
        }
        if (gbAddress >= 0xFEA0 && gbAddress < 0xFF00) {
            if (Logger.verbose >= 2)
                log('Unexpected write in restricted area');
            return;
        }
        if (IO.Handles(gbAddress)) {
            IO.Store(gbAddress, <u8>value);
            return;
        }
        if (Logger.verbose >= 4)
            log(`IO [${uToHex<u16>(gbAddress)}] <- ${uToHex<u8>(<u8>value)} ([${uToHex<u32>(MemoryMap.GBToMemory(gbAddress))}])`);
        store<T>(MemoryMap.GBToMemory(gbAddress), value);
    }

    @inline
    static toHiRam(loAddress: u8): u16 {
        return 0xFF00 + <u16>loAddress;
    }
}

export function loadRom(rom: Uint8Array, start: usize, maxSize: usize): boolean {
    if (Logger.verbose >= 1)
        log(`trying to load rom of size ${rom.byteLength}B at 0x${start.toString(16)}`);
    if (<usize>rom.byteLength > maxSize) {
        if (Logger.verbose >= 1)
            console.log("Unexpected size: " + rom.byteLength.toString());
        return false;
    }
    memory.copy(start, rom.dataStart, rom.byteLength);
    if (Logger.verbose >= 2)
        log(`Loaded rom at 0x${start.toString(16)}(size: ${rom.byteLength})`);
    if (<usize>rom.byteLength < maxSize) {
        if (Logger.verbose >= 2)
            log(`Zeroing ${maxSize - rom.byteLength} bytes from 0x${(start + rom.byteLength).toString(16)} `);
        memory.fill(start + rom.byteLength, 0, maxSize - rom.byteLength);
    }
    return true;
}

export function loadBootRom(bootRom: ArrayBuffer): boolean {
    if (Logger.verbose >= 2)
        log('Loading Boot rom');
    const result = loadRom(Uint8Array.wrap(bootRom), BOOT_ROM_START, BOOT_ROM_SIZE);
    if (result) {
        if (Logger.verbose >= 1)
            log('Boot rom loaded - size: ' + uToHex(bootRom.byteLength));
        MemoryMap.loadedBootRomSize = bootRom.byteLength;
    }
    else
        if (Logger.verbose >= 1)
            log('Unable to load boot rom');
    return result;
}


