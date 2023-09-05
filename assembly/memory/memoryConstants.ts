export const MEMORY_START: u32 = 0x00;

// space for all in-console memory - https://gbdev.io/pandocs/Memory_Map.html

export const GB_VIDEO_START: u32 = MEMORY_START;
export const GB_VIDEO_BANK_SIZE: u32 = 0x2000;
export const GB_VIDEO_SIZE: u32 = 2 * GB_VIDEO_BANK_SIZE; // 1 + 1 bank (CGB)

export const GB_OAM_START: u32 = GB_VIDEO_START + GB_VIDEO_SIZE;
export const GB_OAM_SIZE: u32 = 0x00a0;

export const GB_EXT_RAM_START: u32 = GB_OAM_START + GB_OAM_SIZE;
export const GB_EXT_RAM_BANK_SIZE: u32 = 0x2000;
export const GB_EXT_RAM_SIZE: u32 = GB_EXT_RAM_START + 16 * GB_EXT_RAM_BANK_SIZE;

export const GB_WRAM_START: u32 = GB_EXT_RAM_START + GB_EXT_RAM_SIZE;
export const GB_WRAM_BANK_SIZE: u32 = 0x1000;
export const GB_WRAM_SIZE: u32 = 8 * GB_WRAM_BANK_SIZE; // 1 + up to 7 additional banks (CGB)

export const GB_IO_START: u32 = GB_WRAM_START + GB_WRAM_SIZE;
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