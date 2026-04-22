import { Cpu } from "./cpu/cpu";
import { Interrupt } from "./cpu/interrupts";
import { Dma } from "./io/video/dma";
import { Ppu, PpuMode, PpuOamFifo } from "./io/video/ppu";
import { Timer } from "./io/timer";
import { Cartridge } from "./cartridge";
import { CartridgeType } from "./metadata";
import { MBC1 } from "./memory/mbc1";
import { MBC2 } from "./memory/mbc2";
import { MBC3 } from "./memory/mbc3";
import { MBC5 } from "./memory/mbc5";
import { Lcd } from "./io/video/lcd";
import { TileCache } from "./io/video/tileCache";
import { getRamEnabled, setRamEnabledRaw } from "./memory/mbcTypes";
import {
    GB_VIDEO_START, GB_VIDEO_SIZE,
    GB_OAM_START, GB_OAM_SIZE,
    GB_EXT_RAM_START, GB_EXT_RAM_BANK_SIZE,
    GB_WRAM_START, GB_WRAM_SIZE,
    GB_IO_START, GB_IO_SIZE,
    GB_HIGH_RAM_START, GB_HIGH_RAM_SIZE
} from "./memory/memoryConstants";

export const SAVESTATE_MAGIC: u32 = 0x53564259; // "SVBY"
export const SAVESTATE_VERSION: u16 = 1;

// Binary layout offsets
// Header (12 bytes)
const OFF_MAGIC: u32 = 0;
const OFF_VERSION: u32 = 4;
// [6-7] padding u16
const OFF_EXT_RAM_SIZE: u32 = 8;
// CPU (22 bytes, starts at 12)
const OFF_AF: u32 = 12;
const OFF_BC: u32 = 14;
const OFF_DE: u32 = 16;
const OFF_HL: u32 = 18;
const OFF_SP: u32 = 20;
const OFF_PC: u32 = 22;
const OFF_CYCLE_COUNT: u32 = 24;
const OFF_CPU_FLAGS: u32 = 32; // bit0=isHalted bit1=isStopped bit2=isEnablingIME bit3=masterEnabled
// [33] padding
// Timer (6 bytes, starts at 34)
const OFF_INTERNAL_DIV: u32 = 34;
const OFF_TIMA: u32 = 36;
const OFF_TMA: u32 = 37;
const OFF_TAC: u32 = 38;
// [39] padding
// PPU (28 bytes, starts at 40)
const OFF_PPU_MODE: u32 = 40;
// [41] padding
const OFF_PPU_DOT: u32 = 42;
const OFF_PPU_FRAME: u32 = 44;
const OFF_PPU_WBI: u32 = 48;
const OFF_PPU_SPRITE_COUNT: u32 = 49;
const OFF_FIFO_HEAD: u32 = 50;
const OFF_FIFO_SIZE: u32 = 54;
const OFF_FIFO_BUF: u32 = 58; // 10 bytes
// DMA (4 bytes, starts at 68)
const OFF_DMA_ACTIVE: u32 = 68;
const OFF_DMA_OFFSET: u32 = 69;
const OFF_DMA_VALUE: u32 = 70;
const OFF_DMA_DELAY: u32 = 71;
// MBC (12 bytes, starts at 72)
const OFF_RAM_ENABLED: u32 = 72;
const OFF_ROM_BANK_LOW: u32 = 73;
const OFF_ROM_BANK_HIGH: u32 = 74;
const OFF_RAM_BANK: u32 = 75;
const OFF_MBC1_ADV_MODE: u32 = 76;
const OFF_MBC1_ROM_MASK: u32 = 77;
const OFF_MBC1_ROM0_BANK: u32 = 78;
const OFF_MBC1_ROM1_BANK: u32 = 79;
// [80-83] padding (4 bytes)
// Memory regions (starts at 84)
const OFF_VRAM: u32 = 84;
const OFF_OAM: u32 = OFF_VRAM + GB_VIDEO_SIZE;   // 84 + 16384 = 16468
const OFF_WRAM: u32 = OFF_OAM + GB_OAM_SIZE;     // 16468 + 160 = 16628
const OFF_IO: u32 = OFF_WRAM + GB_WRAM_SIZE;     // 16628 + 32768 = 49396
const OFF_HRAM: u32 = OFF_IO + GB_IO_SIZE;       // 49396 + 128 = 49524
const OFF_EXT_RAM: u32 = OFF_HRAM + GB_HIGH_RAM_SIZE; // 49524 + 128 = 49652

export const SAVESTATE_FIXED_SIZE: u32 = OFF_EXT_RAM;

export function createSaveState(): Uint8Array {
    const extRamSize: u32 = <u32>Cartridge.Data.RamBankCount * GB_EXT_RAM_BANK_SIZE;
    const totalSize: u32 = SAVESTATE_FIXED_SIZE + extRamSize;
    const buf = new Uint8Array(totalSize);
    const p: usize = buf.dataStart;

    // Header
    store<u32>(p + OFF_MAGIC, SAVESTATE_MAGIC);
    store<u16>(p + OFF_VERSION, SAVESTATE_VERSION);
    store<u16>(p + 6, 0);
    store<u32>(p + OFF_EXT_RAM_SIZE, extRamSize);

    // CPU
    store<u16>(p + OFF_AF, Cpu.AF);
    store<u16>(p + OFF_BC, Cpu.BC);
    store<u16>(p + OFF_DE, Cpu.DE);
    store<u16>(p + OFF_HL, Cpu.HL);
    store<u16>(p + OFF_SP, Cpu.StackPointer);
    store<u16>(p + OFF_PC, Cpu.ProgramCounter);
    store<u64>(p + OFF_CYCLE_COUNT, Cpu.CycleCount);
    const cpuFlags: u8 = (Cpu.isHalted ? 1 : 0)
        | (Cpu.isStopped ? 2 : 0)
        | (Cpu.isEnablingIME ? 4 : 0)
        | (Interrupt.masterEnabled ? 8 : 0);
    store<u8>(p + OFF_CPU_FLAGS, cpuFlags);
    store<u8>(p + 33, 0);

    // Timer
    store<u16>(p + OFF_INTERNAL_DIV, Timer.internalDiv);
    store<u8>(p + OFF_TIMA, Timer.Tima);
    store<u8>(p + OFF_TMA, Timer.Tma);
    store<u8>(p + OFF_TAC, Timer.Tac);
    store<u8>(p + 39, 0);

    // PPU
    store<u8>(p + OFF_PPU_MODE, <u8>Ppu.currentMode);
    store<u8>(p + 41, 0);
    store<u16>(p + OFF_PPU_DOT, Ppu.currentDot);
    store<u32>(p + OFF_PPU_FRAME, Ppu.currentFrame);
    store<u8>(p + OFF_PPU_WBI, Ppu.workingBufferIndex);
    store<u8>(p + OFF_PPU_SPRITE_COUNT, Ppu.spriteCountThisFrame);
    store<i32>(p + OFF_FIFO_HEAD, PpuOamFifo.head);
    store<i32>(p + OFF_FIFO_SIZE, PpuOamFifo.size);
    memory.copy(p + OFF_FIFO_BUF, changetype<usize>(PpuOamFifo.buffer), 10);

    // DMA
    store<u8>(p + OFF_DMA_ACTIVE, Dma.active ? 1 : 0);
    store<u8>(p + OFF_DMA_OFFSET, Dma.offset);
    store<u8>(p + OFF_DMA_VALUE, Dma.value);
    store<u8>(p + OFF_DMA_DELAY, Dma.startDelay);

    // MBC
    store<u8>(p + OFF_RAM_ENABLED, getRamEnabled() ? 1 : 0);
    saveMbcBanks(p);
    // [80-83] zeros
    store<u32>(p + 80, 0);

    // Memory regions
    memory.copy(p + OFF_VRAM, GB_VIDEO_START, GB_VIDEO_SIZE);
    memory.copy(p + OFF_OAM, GB_OAM_START, GB_OAM_SIZE);
    memory.copy(p + OFF_WRAM, GB_WRAM_START, GB_WRAM_SIZE);
    memory.copy(p + OFF_IO, GB_IO_START, GB_IO_SIZE);
    memory.copy(p + OFF_HRAM, GB_HIGH_RAM_START, GB_HIGH_RAM_SIZE);
    if (extRamSize > 0) {
        memory.copy(p + OFF_EXT_RAM, GB_EXT_RAM_START, extRamSize);
    }

    return buf;
}

export function loadSaveState(data: Uint8Array): bool {
    const minSize: u32 = SAVESTATE_FIXED_SIZE;
    if (<u32>data.byteLength < minSize) return false;

    const p: usize = data.dataStart;

    if (load<u32>(p + OFF_MAGIC) != SAVESTATE_MAGIC) return false;
    if (load<u16>(p + OFF_VERSION) != SAVESTATE_VERSION) return false;

    const extRamSize: u32 = load<u32>(p + OFF_EXT_RAM_SIZE);
    if (<u32>data.byteLength < SAVESTATE_FIXED_SIZE + extRamSize) return false;

    // CPU
    Cpu.AF = load<u16>(p + OFF_AF);
    Cpu.BC = load<u16>(p + OFF_BC);
    Cpu.DE = load<u16>(p + OFF_DE);
    Cpu.HL = load<u16>(p + OFF_HL);
    Cpu.StackPointer = load<u16>(p + OFF_SP);
    Cpu.ProgramCounter = load<u16>(p + OFF_PC);
    Cpu.CycleCount = load<u64>(p + OFF_CYCLE_COUNT);
    const cpuFlags = load<u8>(p + OFF_CPU_FLAGS);
    Cpu.isHalted = (cpuFlags & 1) != 0;
    Cpu.isStopped = (cpuFlags & 2) != 0;
    Cpu.isEnablingIME = (cpuFlags & 4) != 0;
    Interrupt.masterEnabled = (cpuFlags & 8) != 0;

    // Timer
    Timer.RestoreState(
        load<u16>(p + OFF_INTERNAL_DIV),
        load<u8>(p + OFF_TIMA),
        load<u8>(p + OFF_TMA),
        load<u8>(p + OFF_TAC)
    );

    // PPU
    Ppu.currentMode = <PpuMode>load<u8>(p + OFF_PPU_MODE);
    Ppu.currentDot = load<u16>(p + OFF_PPU_DOT);
    Ppu.currentFrame = load<u32>(p + OFF_PPU_FRAME);
    Ppu.workingBufferIndex = load<u8>(p + OFF_PPU_WBI);
    Ppu.spriteCountThisFrame = load<u8>(p + OFF_PPU_SPRITE_COUNT);
    PpuOamFifo.head = load<i32>(p + OFF_FIFO_HEAD);
    PpuOamFifo.size = load<i32>(p + OFF_FIFO_SIZE);
    memory.copy(changetype<usize>(PpuOamFifo.buffer), p + OFF_FIFO_BUF, 10);

    // DMA
    Dma.active = load<u8>(p + OFF_DMA_ACTIVE) != 0;
    Dma.offset = load<u8>(p + OFF_DMA_OFFSET);
    Dma.value = load<u8>(p + OFF_DMA_VALUE);
    Dma.startDelay = load<u8>(p + OFF_DMA_DELAY);

    // MBC
    setRamEnabledRaw(load<u8>(p + OFF_RAM_ENABLED) != 0);
    loadMbcBanks(p);

    // Memory regions
    memory.copy(GB_VIDEO_START, p + OFF_VRAM, GB_VIDEO_SIZE);
    TileCache.RebuildAll();
    memory.copy(GB_OAM_START, p + OFF_OAM, GB_OAM_SIZE);
    memory.copy(GB_WRAM_START, p + OFF_WRAM, GB_WRAM_SIZE);
    memory.copy(GB_IO_START, p + OFF_IO, GB_IO_SIZE);
    Lcd.SyncFromMemory();
    memory.copy(GB_HIGH_RAM_START, p + OFF_HRAM, GB_HIGH_RAM_SIZE);
    if (extRamSize > 0) {
        memory.copy(GB_EXT_RAM_START, p + OFF_EXT_RAM, extRamSize);
    }

    return true;
}

function saveMbcBanks(p: usize): void {
    const t = Cartridge.Data.cartridgeType;
    if (t == CartridgeType.MBC1 || t == CartridgeType.MBC1_RAM || t == CartridgeType.MBC1_RAM_BATTERY) {
        store<u8>(p + OFF_ROM_BANK_LOW, MBC1.LowRegister);
        store<u8>(p + OFF_ROM_BANK_HIGH, MBC1.HighRegister);
        store<u8>(p + OFF_RAM_BANK, MBC1.ramBank);
        store<u8>(p + OFF_MBC1_ADV_MODE, MBC1.advancedMode ? 1 : 0);
        store<u8>(p + OFF_MBC1_ROM_MASK, MBC1.romBankMask);
        store<u8>(p + OFF_MBC1_ROM0_BANK, MBC1.rom0Bank);
        store<u8>(p + OFF_MBC1_ROM1_BANK, MBC1.rom1Bank);
    } else if (t == CartridgeType.MBC2 || t == CartridgeType.MBC2_BATTERY) {
        store<u8>(p + OFF_ROM_BANK_LOW, <u8>(MBC2.romBank & 0xFF));
        store<u8>(p + OFF_ROM_BANK_HIGH, <u8>((MBC2.romBank >> 8) & 0xFF));
        store<u8>(p + OFF_RAM_BANK, 0);
        store<u8>(p + OFF_MBC1_ADV_MODE, 0);
        store<u8>(p + OFF_MBC1_ROM_MASK, 0);
        store<u8>(p + OFF_MBC1_ROM0_BANK, 0);
        store<u8>(p + OFF_MBC1_ROM1_BANK, 0);
    } else if (t == CartridgeType.MBC3 || t == CartridgeType.MBC3_RAM_2
            || t == CartridgeType.MBC3_RAM_BATTERY_2 || t == CartridgeType.MBC3_TIMER_BATTERY
            || t == CartridgeType.MBC3_TIMER_RAM_BATTERY_2) {
        store<u8>(p + OFF_ROM_BANK_LOW, <u8>(MBC3.romBank & 0xFF));
        store<u8>(p + OFF_ROM_BANK_HIGH, <u8>((MBC3.romBank >> 8) & 0xFF));
        store<u8>(p + OFF_RAM_BANK, MBC3.ramBank);
        store<u8>(p + OFF_MBC1_ADV_MODE, 0);
        store<u8>(p + OFF_MBC1_ROM_MASK, 0);
        store<u8>(p + OFF_MBC1_ROM0_BANK, 0);
        store<u8>(p + OFF_MBC1_ROM1_BANK, 0);
    } else if (t == CartridgeType.MBC5 || t == CartridgeType.MBC5_RAM || t == CartridgeType.MBC5_RAM_BATTERY
            || t == CartridgeType.MBC5_RUMBLE || t == CartridgeType.MBC5_RUMBLE_RAM
            || t == CartridgeType.MBC5_RUMBLE_RAM_BATTERY) {
        store<u8>(p + OFF_ROM_BANK_LOW, MBC5.romBankLow);
        store<u8>(p + OFF_ROM_BANK_HIGH, MBC5.romBankHigh);
        store<u8>(p + OFF_RAM_BANK, MBC5.ramBank);
        store<u8>(p + OFF_MBC1_ADV_MODE, 0);
        store<u8>(p + OFF_MBC1_ROM_MASK, 0);
        store<u8>(p + OFF_MBC1_ROM0_BANK, 0);
        store<u8>(p + OFF_MBC1_ROM1_BANK, 0);
    } else {
        // ROM_ONLY or unsupported: zero out
        store<u8>(p + OFF_ROM_BANK_LOW, 0);
        store<u8>(p + OFF_ROM_BANK_HIGH, 0);
        store<u8>(p + OFF_RAM_BANK, 0);
        store<u8>(p + OFF_MBC1_ADV_MODE, 0);
        store<u8>(p + OFF_MBC1_ROM_MASK, 0);
        store<u8>(p + OFF_MBC1_ROM0_BANK, 0);
        store<u8>(p + OFF_MBC1_ROM1_BANK, 0);
    }
}

function loadMbcBanks(p: usize): void {
    const t = Cartridge.Data.cartridgeType;
    if (t == CartridgeType.MBC1 || t == CartridgeType.MBC1_RAM || t == CartridgeType.MBC1_RAM_BATTERY) {
        MBC1.LowRegister = load<u8>(p + OFF_ROM_BANK_LOW);
        MBC1.HighRegister = load<u8>(p + OFF_ROM_BANK_HIGH);
        MBC1.ramBank = load<u8>(p + OFF_RAM_BANK);
        MBC1.advancedMode = load<u8>(p + OFF_MBC1_ADV_MODE) != 0;
        MBC1.romBankMask = load<u8>(p + OFF_MBC1_ROM_MASK);
        MBC1.rom0Bank = load<u8>(p + OFF_MBC1_ROM0_BANK);
        MBC1.rom1Bank = load<u8>(p + OFF_MBC1_ROM1_BANK);
    } else if (t == CartridgeType.MBC2 || t == CartridgeType.MBC2_BATTERY) {
        MBC2.romBank = <u32>load<u8>(p + OFF_ROM_BANK_LOW)
            | (<u32>load<u8>(p + OFF_ROM_BANK_HIGH) << 8);
    } else if (t == CartridgeType.MBC3 || t == CartridgeType.MBC3_RAM_2
            || t == CartridgeType.MBC3_RAM_BATTERY_2 || t == CartridgeType.MBC3_TIMER_BATTERY
            || t == CartridgeType.MBC3_TIMER_RAM_BATTERY_2) {
        MBC3.romBank = <u32>load<u8>(p + OFF_ROM_BANK_LOW)
            | (<u32>load<u8>(p + OFF_ROM_BANK_HIGH) << 8);
        MBC3.ramBank = load<u8>(p + OFF_RAM_BANK);
    } else if (t == CartridgeType.MBC5 || t == CartridgeType.MBC5_RAM || t == CartridgeType.MBC5_RAM_BATTERY
            || t == CartridgeType.MBC5_RUMBLE || t == CartridgeType.MBC5_RUMBLE_RAM
            || t == CartridgeType.MBC5_RUMBLE_RAM_BATTERY) {
        MBC5.romBankLow = load<u8>(p + OFF_ROM_BANK_LOW);
        MBC5.romBankHigh = load<u8>(p + OFF_ROM_BANK_HIGH);
        MBC5.ramBank = load<u8>(p + OFF_RAM_BANK);
    }
    // ROM_ONLY: nothing to restore
}
