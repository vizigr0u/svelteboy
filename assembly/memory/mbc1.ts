import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { MBC } from "./mbc";
import { enableRam, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

// 48-byte Nintendo logo present at $0104 of every cart, and at $40104 on MBC1M.
const NINTENDO_LOGO: u8[] = [
    0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D,
    0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E, 0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99,
    0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC, 0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E,
];

function detectMulticart(romBankCount: u16): boolean {
    // MBC1M packs four 256 KiB games into a 1 MiB ROM. Detection: the
    // Nintendo logo is duplicated at bank $10's header (ROM offset $40104).
    // Bank $10 must exist in cart, so require >16 banks.
    if (romBankCount <= 16) return false;
    const base: u32 = CARTRIDGE_ROM_START + 0x40104;
    for (let i: i32 = 0; i < NINTENDO_LOGO.length; i++) {
        if (load<u8>(base + <u32>i) != NINTENDO_LOGO[i]) return false;
    }
    return true;
}

@final
export class MBC1 {
    static LowRegister: u8 = 1;
    static HighRegister: u8 = 0;
    static advancedMode: boolean = false;
    static multicart: boolean = false;

    static romBankMask: u8 = 0xFF;
    static rom0Bank: u8 = 0;
    static rom1Bank: u8 = 1;
    static ramBank: u8 = 0;

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC1');
        MBC1.advancedMode = false;
        MBC1.LowRegister = 1;
        MBC1.HighRegister = 0;

        MBC1.rom0Bank = 0;
        MBC1.rom1Bank = 1;
        MBC1.ramBank = 0;
        assert(Cartridge.Data.RomBankCount <= 128, 'Unexpectedly large number for ROM banks for MBC1 ROM');
        MBC1.romBankMask = <u8>(Cartridge.Data.RomBankCount - 1)
        MBC1.multicart = detectMulticart(Cartridge.Data.RomBankCount);
        if (MBC1.multicart && Logger.verbose >= 1)
            log('Detected MBC1M multicart');
        enableRam(false);
        MBC.extRamMask = 0x1FFF;
        MBC1.Recache();
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        const lowMask: u8 = MBC1.multicart ? 0x0F : 0x1F;
        const highShift: u8 = MBC1.multicart ? 4 : 5;
        const hiByte: u8 = <u8>(gbAddress >> 12);
        switch (hiByte) {
            case 0x0:
            case 0x1:
                enableRam((value & 0xF) == 0xA);
                MBC1.Recache();
                return;
            case 0x2:
            case 0x3:
                const masked: u8 = value & lowMask;
                MBC1.LowRegister = masked == 0 ? 1 : masked;
                break;
            case 0x4:
            case 0x5:
                MBC1.HighRegister = (value & 0b11);
                break;
            case 0x6:
            case 0x7:
                MBC1.advancedMode = (value & 1) == 1;
                if (Cartridge.Data.RamBankCount <= 1 && Cartridge.Data.RomBankCount <= 32) {
                    if (Logger.verbose >= 1) {
                        log('Ignoring MBC write to range 0x6000-0x7FFF on smaller cartridge.')
                    }
                    MBC1.advancedMode = false;
                }
                break;
        }

        const oldRom0 = MBC1.rom0Bank;
        const oldRom1 = MBC1.rom1Bank;
        const oldRam = MBC1.ramBank;
        MBC1.rom0Bank = MBC1.advancedMode ? <u8>((MBC1.HighRegister << highShift) & MBC1.romBankMask) : 0;
        MBC1.rom1Bank = <u8>(((MBC1.HighRegister << highShift) | MBC1.LowRegister) & MBC1.romBankMask);
        MBC1.ramBank = MBC1.advancedMode ? MBC1.HighRegister : 0;
        if (oldRam != MBC1.ramBank && Logger.verbose >= 2) {
            log(`Switching Ram bank from ${oldRam} to ${MBC1.ramBank} ([${uToHex<u16>(gbAddress)}] <- ${value})`)
        }
        if (oldRom1 != MBC1.rom1Bank && Logger.verbose >= 2) {
            log(`Switching Rom bank 1 from ${oldRom1} to ${MBC1.rom1Bank} ([${uToHex<u16>(gbAddress)}] <- ${value})`)
        }
        if (oldRom0 != MBC1.rom0Bank && Logger.verbose >= 2) {
            log(`Switching Rom bank 0 from ${oldRom0} to ${MBC1.rom0Bank} ([${uToHex<u16>(gbAddress)}] <- ${value})`)
        }
        MBC1.Recache();
    }

    @inline
    static Recache(): void {
        MBC.rom0Base = CARTRIDGE_ROM_START + <u32>MBC1.rom0Bank * ROM_BANK_SIZE;
        MBC.rom1Base = CARTRIDGE_ROM_START + <u32>MBC1.rom1Bank * ROM_BANK_SIZE;
        MBC.extRamBase = GB_EXT_RAM_START + <u32>MBC1.ramBank * GB_EXT_RAM_BANK_SIZE;
    }
}
