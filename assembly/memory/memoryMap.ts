import { Cpu } from "../cpu/cpu";
import { Logger } from "../debug/logger";
import { IO } from "../io/io";
import { Dma } from "../io/video/dma";
import { Lcd } from "../io/video/lcd";
import { Oam } from "../io/video/oam";
import { Ppu, PpuMode } from "../io/video/ppu";
import { TileCache } from "../io/video/tileCache";
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

function logRamDisabled(gbAddress: u16): void {
    log('Warning, accessing RAM while disabled, at ' + uToHex<u16>(gbAddress));
}

function logExtRam(): void {
    log('Reading EXT RAM ' + Cpu.GetTrace());
}

function logDmaBlock(gbAddress: u16): void {
    log('Trying to access ' + uToHex<u16>(gbAddress) + ' during DMA, returning 0xFF');
}

function logEchoRam(gbAddress: u16): void {
    log('Ignoring access to Echo RAM ' + uToHex<u16>(gbAddress));
}

function logUnusableArea(gbAddress: u16): void {
    log('Ignoring access to unusable area ' + uToHex<u16>(gbAddress));
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

    static GBToMemory(addr: u32): u32 {
        if (addr < 0x8000) {
            if (MemoryMap.useBootRom && addr < MemoryMap.loadedBootRomSize)
                return BOOT_ROM_START + addr;
            return MBC.MapRom(addr);
        }
        if (addr < 0xA000) return addr - 0x8000; // VRAM (GB_VIDEO_START = 0)
        if (addr < 0xC000) return MBC.MapRam(addr); // ExtRam
        if (addr < 0xE000) return GB_WRAM_START + addr - 0xC000; // WRAM
        // 0xE000-0xFFFF
        if (addr >= 0xFF80) return GB_HIGH_RAM_START + addr - 0xFF80; // HRAM
        if (addr <= 0xFDFF) {
            if (Logger.verbose >= 2)
                logEchoRam(<u16>addr);
            return GB_RESTRICTED_AREA_ADDRESS;
        }
        if (addr <= 0xFE9F) return GB_OAM_START + addr - 0xFE00; // OAM
        if (addr <= 0xFEFF) {
            if (Logger.verbose >= 2)
                logUnusableArea(<u16>addr);
            return GB_RESTRICTED_AREA_ADDRESS;
        }
        // IO (0xFF00-0xFF7F)
        if (Logger.verbose >= 2)
            log('Warning: accessing IO region through Memory Mapper instead of dedicated read/write methods.');
        return GB_IO_START + addr - 0xFF00;
    }

    static GBload<T>(gbAddress: u16): T {
        const addr: u32 = gbAddress;
        if (addr < 0xFE00 || addr >= 0xFF80) { // ROM and RAM
            if (Dma.active && addr < 0xFF80)
                return <T>0xFF;
            if (addr >= 0x8000 && addr < 0xA000) { // VRAM
                if (Lcd.IsPpuEnabled && Ppu.currentMode == PpuMode.Transfer)
                    return <T>0xff;
            } else if (addr >= 0xA000 && addr < 0xC000) {
                if (!isRamEnabled()) {
                    if (Logger.verbose >= 2)
                        logRamDisabled(gbAddress);
                    // return <T>-1;
                }
                if (Logger.verbose >= 2)
                    logExtRam();
            }
            return load<T>(MemoryMap.GBToMemory(addr));
        }
        if (addr < 0xFEA0) // OAM
            return Oam.Load<T>(gbAddress);
        if (addr < 0xFF00) { // Restricted Area
            if (Logger.verbose >= 3)
                log('Unexpected read in restricted area');
            return <T>-1;
        }
        // IO
        if (Dma.active) {
            if (Logger.verbose >= 1) {
                logDmaBlock(gbAddress);
            }
            return <T>-1;
        }
        return <T>(IO.Load(gbAddress));
    }

    static GBstore<T>(gbAddress: u16, value: T): void {
        const addr: u32 = gbAddress;
        if (addr < 0xFF80 && Dma.active) {
            if (Logger.verbose >= 2) {
                log(`Trying to write to ${uToHex<u16>(gbAddress)} during DMA, ignored.`);
            }
            return;
        }
        if (addr < 0x8000) { // ROM
            MBC.HandleWrite(gbAddress, <u8>value);
            return;
        }
        if (addr < 0xA000) { // VRAM
            if (Lcd.IsPpuEnabled && Ppu.currentMode == PpuMode.Transfer)
                return;
            store<T>(MemoryMap.GBToMemory(addr), value);
            if (addr < 0x9800) {
                TileCache.decode(gbAddress);
            }
            return;
        }
        if (addr < 0xE000 || addr >= 0xFF80) { // all types of RAM
            if (addr >= 0xA000 && addr < 0xC000) {
                setRamAltered();
                if (Logger.verbose >= 2)
                    log('Writing to EXT RAM ' + Cpu.GetTrace())
            }
            store<T>(MemoryMap.GBToMemory(addr), value);
            if (addr < 0x9800) { // tile data
                TileCache.decode(gbAddress);
            }
            return;
        }
        if (addr < 0xFE00) {
            if (Logger.verbose >= 2)
                log('Unexpected write in echo RAM');
            return;
        }
        if (addr < 0xFEA0) {
            Oam.Store<T>(gbAddress, value);
            return;
        }
        if (addr < 0xFF00) {
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
            log("Unexpected size: " + rom.byteLength.toString());
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
    memory.copy(result.dataStart, MemoryMap.GBToMemory(<u32>from), count);
    MemoryMap.useBootRom = oldUseBoot;
    return result;
}
