---
name: gameboy-docs
description: Reference guide for Pan Docs — the Game Boy hardware documentation in pandocs/src/. Use this to look up correct hardware behaviour when implementing or debugging emulator features.
argument-hint: [optional: topic area, e.g. "ppu", "audio", "mbc", "cpu"]
---

You are working on SvelteBoy, a Game Boy DMG emulator. Use this guide to know **which Pan Docs file to read** (`pandocs/src/<file>`) when you need authoritative hardware reference.

---

## CPU

| When you need to... | Read |
|---------------------|------|
| Look up any instruction (encoding, flags, cycles) | `CPU_Instruction_Set.md` |
| Check register layout, flag bits (Z/N/H/C), AF/BC/DE/HL/SP/PC | `CPU_Registers_and_Flags.md` |
| Compare SM83 behaviour against Z80 or Intel 8080 | `CPU_Comparison_with_Z80.md` |
| Understand HALT instruction, halt bug with IME disabled | `halt.md` |

## Interrupts

| When you need to... | Read |
|---------------------|------|
| Understand IME, IE register, IF flag, interrupt dispatch | `Interrupts.md` |
| Look up specific interrupt sources (VBlank, STAT, Timer, Serial, Joypad) | `Interrupt_Sources.md` |

## Timers

| When you need to... | Read |
|---------------------|------|
| Understand DIV, TIMA, TMA, TAC registers | `Timer_and_Divider_Registers.md` |
| Debug obscure timer edge cases, DIV-TIMA relationship, glitches | `Timer_Obscure_Behaviour.md` |

## Memory

| When you need to... | Read |
|---------------------|------|
| Look up the full address space layout (ROM, RAM, VRAM, I/O, HRAM) | `Memory_Map.md` |
| Find any I/O register address or a quick description of all hardware registers | `Hardware_Reg_List.md` |

## MBCs (Memory Bank Controllers)

| When you need to... | Read |
|---------------------|------|
| Understand MBC concepts, bank switching, and timing issues generally | `MBCs.md` |
| Implement or debug ROM-only (no MBC) cartridges | `nombc.md` |
| Implement or debug MBC1 (most common, up to 2MB ROM / 32KB RAM) | `MBC1.md` |
| Implement or debug MBC2 (256KB ROM, built-in 512×4-bit RAM) | `MBC2.md` |
| Implement or debug MBC3 (2MB ROM / 32KB RAM + real-time clock) | `MBC3.md` |
| Implement or debug MBC5 (8MB ROM / 128KB RAM, required for GBC double-speed) | `MBC5.md` |
| Implement or debug MBC6 (dual switchable ROM/RAM banks + flash) | `MBC6.md` |
| Implement or debug MBC7 (accelerometer + EEPROM, tilt games) | `MBC7.md` |
| Implement or debug HuC1 (Hudson Soft MBC1 variant + IR) | `HuC1.md` |
| Implement or debug HuC3 (Hudson Soft, RTC + speaker + IR) | `HuC3.md` |
| Implement or debug MMM01 (multi-game compilation mapper) | `MMM01.md` |
| Implement or debug M161 (simple multi-cart, 8 banks) | `M161.md` |
| Look up other uncommon mappers (MBC1M, EMS, Bung, unlicensed) | `othermbc.md` |
| Parse the cartridge header (title, type byte, ROM/RAM size bytes, CGB flag) | `The_Cartridge_Header.md` |

## PPU / Graphics / Video

| When you need to... | Read |
|---------------------|------|
| Get an overview of tile-based graphics, layers (BG, Window, Objects) | `Graphics.md` |
| Understand the PPU rendering pipeline, scanlines, dots, Mode 0-3 | `Rendering.md` |
| Look up the LCDC register (display enable, BG/window/sprite enables, tile map select) | `LCDC.md` |
| Look up the STAT register (LY, LYC, PPU mode, interrupt sources) | `STAT.md` |
| Understand tile data storage in VRAM, 16-byte encoding, address blocks | `Tile_Data.md` |
| Understand tile maps, 32×32 maps, tile indexing, CGB attributes | `Tile_Maps.md` |
| Look up OAM sprite structure (position, tile, attributes for 40 sprites) | `OAM.md` |
| Understand OAM DMA transfer timing and CPU restrictions during transfer | `OAM_DMA_Transfer.md` |
| Understand when CPU can access VRAM/OAM and PPU mode timing locks | `Accessing_VRAM_and_OAM.md` |
| Implement scrolling (SCX/SCY viewport registers, WX/WY window position) | `Scrolling.md` |
| Understand DMG/CGB palette registers (BGP, OBP0/1, CGB palette RAM) | `Palettes.md` |
| Implement the pixel FIFO, pixel fetcher steps, FIFO manipulation during Mode 3 | `pixel_fifo.md` |
| Debug or avoid the OAM corruption bug (Mode 2 + 16-bit register ops on DMG) | `OAM_Corruption_Bug.md` |
| Look up GBC-specific registers (HDMA, VRAM banking, color palettes, speed switch) | `CGB_Registers.md` |

## Audio (APU)

| When you need to... | Read |
|---------------------|------|
| Get an overview of the four audio channels and stereo mixing | `Audio.md` |
| Look up any NRxy audio register (NR10–NR52, wave RAM) | `Audio_Registers.md` |
| Understand low-level APU signal generation circuits, envelope, sweep, length timer internals | `Audio_details.md` |

## I/O

| When you need to... | Read |
|---------------------|------|
| Read or write joypad buttons/D-Pad via the P1/JOYP register | `Joypad_Input.md` |
| Implement serial link cable communication (SB/SC registers, master/slave) | `Serial_Data_Transfer_(Link_Cable).md` |
| Implement GBC infrared port (RP register) | `IR.md` |

## Hardware / Power

| When you need to... | Read |
|---------------------|------|
| Look up clock speeds, RAM/VRAM sizes across DMG/CGB/SGB revisions | `Specifications.md` |
| Understand boot ROM execution, logo check, header validation sequence | `Power_Up_Sequence.md` |
| Reduce power consumption using HALT and STOP | `Reducing_Power_Consumption.md` |
| Understand cartridge slot, link port, audio jack pinouts | `External_Connectors.md` |

## Peripherals

| When you need to... | Read |
|---------------------|------|
| Interface with the Game Boy Camera cartridge and sensor registers | `Gameboy_Camera.md` |
| Implement Game Boy Printer protocol over link cable | `Gameboy_Printer.md` |
| Implement DMG-07 four-player adapter multiplayer protocol | `Four_Player_Adapter.md` |

## Cheats / Misc

| When you need to... | Read |
|---------------------|------|
| Implement Game Genie / Game Shark cheat code patching | `Shark_Cheats.md` |

---

All files are in `pandocs/src/`. Read the relevant file directly before implementing hardware behaviour — Pan Docs is the authoritative source for GB/GBC hardware accuracy.

$ARGUMENTS
