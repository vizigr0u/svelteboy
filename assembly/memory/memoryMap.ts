import { Cpu } from "../cpu/cpu";
import { Logger } from "../debug/logger";
import { IO } from "../io/io";
import { Dma } from "../io/video/dma";
import { Oam } from "../io/video/oam";
import { uToHex } from "../utils/stringUtils";
import { MBC } from "./mbc";
import { isRamEnabled, setRamAltered } from "./mbcTypes";
import {
    BOOT_ROM_START,
    GB_VIDEO_START,
    GB_WRAM_START,
    GB_IO_START,
    GB_HIGH_RAM_START,
    GB_RESTRICTED_AREA_ADDRESS,
    BOOT_ROM_SIZE,
    GB_VIDEO_SIZE,
    GB_WRAM_SIZE,
    GB_HIGH_RAM_SIZE,
    GB_OAM_SIZE,
    GB_OAM_START
} from "./memoryConstants";

function log(s: string): void {
    Logger.Log("MEM: " + s);
}

@final
export class MemoryMap {
    static useBootRom: boolean = false;
    static loadedBootRomSize: u32 = 0;
    static loadedCartridgeRomSize: u32 = 0;

    static Init(useBootRom: boolean = true): void {
        if (Logger.verbose >= 1)
            log('Initialized MemoryMap, using boot : ' + useBootRom.toString());

        MBC.Init();
        memory.fill(GB_VIDEO_START, 0, GB_VIDEO_SIZE);
        memory.fill(GB_OAM_START, 0, GB_OAM_SIZE);
        memory.fill(GB_WRAM_START, 0, GB_WRAM_SIZE);
        memory.fill(GB_HIGH_RAM_START, 0, GB_HIGH_RAM_SIZE);
        MemoryMap.useBootRom = useBootRom;
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
            case 0x4:
            case 0x5:
            case 0x6:
            case 0x7:
                return MBC.MapRom(gbAddress);
            case 0x8:
            case 0x9:
                return GB_VIDEO_START + gbAddress - 0x8000;
            case 0xA:
            case 0xB:
                return MBC.MapRam(gbAddress);
            case 0xC:
            case 0xD:
                return GB_WRAM_START + gbAddress - 0xC000;
            case 0xE:
            case 0xF:
                if (gbAddress >= 0xFF80)
                    return GB_HIGH_RAM_START + gbAddress - 0xFF80;
                if (gbAddress <= 0xFDFF) {
                    if (Logger.verbose >= 2)
                        log('Ignoring access to Echo RAM ' + uToHex<u16>(gbAddress))
                    return GB_RESTRICTED_AREA_ADDRESS;
                }
                if (gbAddress <= 0xFE9F)
                    return GB_OAM_START + gbAddress - 0xFE00;
                if (gbAddress <= 0xFEFF) {
                    if (Logger.verbose >= 2)
                        log('Ignoring access to unusable area ' + uToHex<u16>(gbAddress))
                    return GB_RESTRICTED_AREA_ADDRESS;
                }
                if (gbAddress < 0xFF80) {
                    if (Logger.verbose >= 2) {
                        log('Warning: accessing IO region through Memory Mapper instead of dedicated read/write methods.');
                    }
                    return GB_IO_START + gbAddress - 0xFF00;
                }
            default:
                assert(false, `(?!) unmapped address: ${uToHex<u16>(gbAddress)} (hibyte: ${uToHex<u8>(hiByte)})`);
        }
        assert(false);
        return GB_RESTRICTED_AREA_ADDRESS;
    }

    static GBload<T>(gbAddress: u16): T {
        if (gbAddress < 0xFE00 || gbAddress >= 0xFF80) { // ROM and RAM
            if (gbAddress >= 0xA000 && gbAddress < 0xC000) {
                if (!isRamEnabled()) {
                    if (Logger.verbose >= 2)
                        log('Warning, accessing RAM while disabled, at ' + uToHex<u16>(gbAddress));
                    // return <T>-1;
                }
                if (Logger.verbose >= 2)
                    log('Reading EXT RAM ' + Cpu.GetTrace())
            }
            return load<T>(MemoryMap.GBToMemory(gbAddress));
        }
        if (gbAddress < 0xFEA0) // OAM
            return Oam.Load<T>(gbAddress);
        if (gbAddress < 0xFF00) { // Restricted Area
            if (Logger.verbose >= 3)
                log('Unexpected read in restricted area');
            return <T>-1;
        }
        // IO
        if (Dma.active) {
            if (Logger.verbose >= 1) {
                log(`Trying to access ${uToHex<u16>(gbAddress)} during DMA, returning 0xFF`);
            }
            return <T>-1;
        }
        return <T>(IO.Load(gbAddress));
    }

    static GBstore<T>(gbAddress: u16, value: T): void {
        if (gbAddress < 0xFF80 && Dma.active) {
            if (Logger.verbose >= 2) {
                log(`Trying to write to ${uToHex<u16>(gbAddress)} during DMA, ignored.`);
            }
            return;
        }
        if (gbAddress < 0x8000) { // ROM
            MBC.HandleWrite(gbAddress, <u8>value);
            return;
        }
        if (gbAddress < 0xE000 || gbAddress >= 0xFF80) { // all types of RAM
            if (gbAddress >= 0xA000 && gbAddress < 0xC000) {
                setRamAltered();
                if (Logger.verbose >= 2)
                    log('Writing to EXT RAM ' + Cpu.GetTrace())
            }
            store<T>(MemoryMap.GBToMemory(gbAddress), value);
            return;
        }
        if (gbAddress < 0xFE00) {
            if (Logger.verbose >= 2)
                log('Unexpected write in echo RAM');
            return;
        }
        if (gbAddress < 0xFEA0) {
            Oam.Store<T>(gbAddress, value);
            return;
        }
        if (gbAddress < 0xFF00) {
            if (Logger.verbose >= 2)
                log('Unexpected write in restricted area');
            return;
        }
        IO.Store(gbAddress, <u8>value);
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

export function hexDump(from: u16, count: u16): Uint8Array {
    const result = new Uint8Array(count);
    const oldUseBoot = MemoryMap.useBootRom;
    MemoryMap.useBootRom = false;
    memory.copy(result.dataStart, MemoryMap.GBToMemory(from), count);
    MemoryMap.useBootRom = oldUseBoot;
    return result;
}
