import { Cartridge } from "../cartridge";
import { Metadata, CartridgeType } from "../metadata";
import { MBC } from "../memory/mbc";
import { MemoryMap } from "../memory/memoryMap";
import { SaveGame } from "../memory/savegame";
import {
    CARTRIDGE_ROM_START,
    ROM_BANK_SIZE,
    GB_EXT_RAM_START,
    GB_EXT_RAM_BANK_SIZE,
} from "../memory/memoryConstants";

/**
 * Set up a cartridge for MBC testing without loading a real ROM.
 * Stamps each ROM bank with a unique sentinel byte (bankIndex & 0xFF) at offset 0.
 * RAM banks filled with 0x00.
 *
 * @param type       CartridgeType enum value (MBC1, MBC2, MBC3, ROM_ONLY, …)
 * @param romSizeByte header romSize byte: RomBankCount = 1 << (romSizeByte + 1), max 8
 * @param ramSizeByte header ramSize byte: 0=none, 2=1 bank, 3=4 banks
 */
export function setupMBCCart(type: CartridgeType, romSizeByte: u8, ramSizeByte: u8 = 0): void {
    const meta = new Metadata();
    meta.cartridgeType = type;
    meta.romSizeByte = romSizeByte;
    meta.ramSizeByte = ramSizeByte;
    Cartridge.Data = meta;

    const bankCount: u16 = meta.RomBankCount;
    const totalRomBytes: u32 = <u32>bankCount * ROM_BANK_SIZE;

    // Clear all ROM banks, then stamp each with its index at offset 0.
    memory.fill(CARTRIDGE_ROM_START, 0, totalRomBytes);
    for (let b: u16 = 0; b < bankCount; b++) {
        store<u8>(CARTRIDGE_ROM_START + <u32>b * ROM_BANK_SIZE, <u8>(b & 0xFF));
    }

    // Clear external RAM banks.
    const ramBankCount: u16 = meta.RamBankCount;
    if (ramBankCount > 0) {
        memory.fill(GB_EXT_RAM_START, 0, <u32>ramBankCount * GB_EXT_RAM_BANK_SIZE);
    }

    MemoryMap.loadedCartridgeRomSize = totalRomBytes;
    MemoryMap.useBootRom = false;

    MBC.Init();
}

/** Read sentinel byte from the currently-mapped ROM bank at GB address 0x0000 (bank 0 window). */
export function readRomBank0Sentinel(): u8 {
    return MemoryMap.GBload<u8>(0x0000);
}

/** Read sentinel byte from the currently-mapped ROM bank at GB address 0x4000 (bank N window). */
export function readRomBank1Sentinel(): u8 {
    return MemoryMap.GBload<u8>(0x4000);
}

/** Write a byte to the currently-mapped external RAM (GB address 0xA000). */
export function writeRam(value: u8): void {
    MemoryMap.GBstore<u8>(0xA000, value);
}

/** Read a byte from the currently-mapped external RAM (GB address 0xA000). */
export function readRam(): u8 {
    return MemoryMap.GBload<u8>(0xA000);
}

/** Send a bank-switch write to the MBC via the memory bus (goes through MemoryMap). */
export function mbcWrite(gbAddress: u16, value: u8): void {
    MemoryMap.GBstore<u8>(gbAddress, value);
}

/** Nintendo logo bytes — must appear at $0104 on every cart, and at $40104 on MBC1M. */
const NINTENDO_LOGO: u8[] = [
    0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D,
    0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E, 0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99,
    0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC, 0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E,
];

/**
 * Set up a 1 MiB (64-bank) MBC1 cartridge with the Nintendo logo planted at
 * $40104 so MBC.Init() detects it as a multicart (MBC1M).
 */
export function setupMBC1MultiCart(): void {
    setupMBCCart(CartridgeType.MBC1, 5, 0); // 64 banks
    for (let i: i32 = 0; i < NINTENDO_LOGO.length; i++) {
        store<u8>(CARTRIDGE_ROM_START + 0x40104 + <u32>i, NINTENDO_LOGO[i]);
    }
    MBC.Init();
}

/**
 * Snapshot the current SaveGame buffer into a fresh ArrayBuffer.
 *
 * `SaveGame.GetBuffer()` returns a view over a static singleton buffer; passing
 * that view to a later `SaveGame.LoadSave` would alias the destination. Tests
 * that save+reload (or compare two saves) must copy first.
 */
export function snapshotSaveBuffer(): Uint8Array {
    return SaveGame.GetBuffer().slice(0);
}
