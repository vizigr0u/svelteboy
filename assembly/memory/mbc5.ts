import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { CartridgeType } from "../metadata";
import { uToHex } from "../utils/stringUtils";
import { MBC } from "./mbc";
import { enableRam, log } from "./mbcTypes";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_BANK_SIZE, GB_EXT_RAM_START, ROM_BANK_SIZE } from "./memoryConstants";

function isRumbleCart(t: CartridgeType): boolean {
    return t == CartridgeType.MBC5_RUMBLE
        || t == CartridgeType.MBC5_RUMBLE_RAM
        || t == CartridgeType.MBC5_RUMBLE_RAM_BATTERY;
}

@final
export class MBC5 {
    static romBankLow: u8 = 1;
    static romBankHigh: u8 = 0;
    static romBankMask: u32 = 0x1FF;
    static ramBank: u8 = 0;
    static rumble: boolean = false;
    static motor: boolean = false;

    static Init(): void {
        if (Logger.verbose >= 1)
            log('Initializing MBC5');
        MBC5.romBankLow = 1;
        MBC5.romBankHigh = 0;
        MBC5.ramBank = 0;
        MBC5.romBankMask = (<u32>Cartridge.Data.RomBankCount - 1) & 0x1FF;
        MBC5.rumble = isRumbleCart(Cartridge.Data.cartridgeType);
        MBC5.motor = false;
        enableRam(false);
        MBC.extRamMask = 0x1FFF;
        MBC5.Recache();
    }

    static HandleWrite(gbAddress: u16, value: u8): void {
        const hiByte: u8 = <u8>(gbAddress >> 12);
        if (hiByte <= 0x1) {
            enableRam((value & 0x0F) == 0x0A);
        } else if (hiByte == 0x2) {
            if (MBC5.romBankLow != value && Logger.verbose >= 2)
                log(`Switching ROM bank low from ${MBC5.romBankLow} to ${value} ([${uToHex<u16>(gbAddress)}] <- ${value})`);
            MBC5.romBankLow = value;
        } else if (hiByte == 0x3) {
            const newHigh: u8 = value & 0x01;
            if (MBC5.romBankHigh != newHigh && Logger.verbose >= 2)
                log(`Switching ROM bank high bit to ${newHigh}`);
            MBC5.romBankHigh = newHigh;
        } else if (hiByte <= 0x5) {
            const bankMask: u8 = MBC5.rumble ? 0x07 : 0x0F;
            const newRamBank: u8 = value & bankMask;
            if (MBC5.rumble) MBC5.motor = (value & 0x08) != 0;
            if (MBC5.ramBank != newRamBank && Logger.verbose >= 2)
                log(`Switching RAM bank from ${MBC5.ramBank} to ${newRamBank}`);
            MBC5.ramBank = newRamBank;
        }
        MBC5.Recache();
    }

    @inline
    static Recache(): void {
        const romBank: u32 = (((<u32>MBC5.romBankHigh << 8) | MBC5.romBankLow)) & MBC5.romBankMask;
        MBC.rom0Base = CARTRIDGE_ROM_START;
        MBC.rom1Base = CARTRIDGE_ROM_START + romBank * ROM_BANK_SIZE;
        MBC.extRamBase = GB_EXT_RAM_START + <u32>MBC5.ramBank * GB_EXT_RAM_BANK_SIZE;
    }
}
