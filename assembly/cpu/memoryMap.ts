import { Logger, log } from "../debug/logger";
import { IO } from "../io/io";
import { Dma } from "../io/video/dma";
import { Oam } from "../io/video/oam";
import { uToHex } from "../utils/stringUtils";
import {
    BOOT_ROM_START,
    CARTRIDGE_ROM_START,
    ROM_BANK_SIZE,
    GB_VIDEO_START,
    GB_VIDEO_BANK_SIZE,
    GB_RAM_START,
    GB_RAM_BANK_SIZE,
    GB_IO_START,
    GB_HIGH_RAM_START,
    GB_RESTRICTED_AREA_ADDRESS,
    BOOT_ROM_SIZE
} from "./memoryConstants";

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
        if (gbAddress < 0xFF80 && Dma.active) {
            if (Logger.verbose >= 1) {
                log(`Trying to access ${uToHex<u16>(gbAddress)} during DMA, returning 0xFF`);
            }
            // return <T>0xFF;
        }
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
        if (gbAddress < 0xFF80 && Dma.active) {
            if (Logger.verbose >= 2) {
                log(`Trying to write to ${uToHex<u16>(gbAddress)} during DMA, ignored.`);
            }
            // return;
        }
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


