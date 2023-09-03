import { Cartridge } from "../cartridge";
import { Logger } from "../debug/logger";
import { CartridgeType } from "../metadata";
import { uToHex } from "../utils/stringUtils";
import { MBC1 } from "./mbc1";
import { CARTRIDGE_ROM_START, GB_EXT_RAM_START } from "./memoryConstants";

export function log(s: string): void {
    Logger.Log("MBC: " + s);
}

type MBC_Handler = (gbAddress: u16, value: u8) => void;
type MBC_Mapper = (gbAdress: u16) => u32;

function NOMBC_Handler(gbAddress: u16, value: u8): void {
    if (Logger.verbose >= 2) {
        log('Ignoring writing to ROM with cartridge with no MBC: ' + `${uToHex<u8>(value)} to ${uToHex<u16>(gbAddress)}`)
    }
}

function DefaultRomMapper(gbAddress: u16): u32 {
    return <u32>gbAddress + CARTRIDGE_ROM_START;
}

function DefaultRamMapper(gbAddress: u16): u32 {
    return <u32>gbAddress + GB_EXT_RAM_START - 0xA000;
}

function getHandler(t: CartridgeType): MBC_Handler {
    switch (t) {
        case CartridgeType.ROM_ONLY:
            return NOMBC_Handler;
        case CartridgeType.MBC1:
        case CartridgeType.MBC1_RAM:
        case CartridgeType.MBC1_RAM_BATTERY:
            return MBC1.HandleWrite;
        default:
            return MBC1.HandleWrite;
    }
}

function getRomMapper(t: CartridgeType): MBC_Mapper {
    switch (t) {
        case CartridgeType.ROM_ONLY:
            return DefaultRomMapper;
        case CartridgeType.MBC1:
        case CartridgeType.MBC1_RAM:
        case CartridgeType.MBC1_RAM_BATTERY:
            return DefaultRomMapper;
        default:
            return DefaultRomMapper;
    }
}

function getRamMapper(t: CartridgeType): MBC_Mapper {
    switch (t) {
        case CartridgeType.ROM_ONLY:
            return DefaultRamMapper;
        case CartridgeType.MBC1:
        case CartridgeType.MBC1_RAM:
        case CartridgeType.MBC1_RAM_BATTERY:
            return DefaultRamMapper;
        default:
            return DefaultRamMapper;
    }
}

@final
export class MBC {
    // static currentType: CartridgeType = CartridgeType.ROM_ONLY;
    static ramEnabled: boolean = false;

    // private static romBank: u16 = 1;
    // private static ramBank: u16 = 0;
    private static writeHandle: MBC_Handler = NOMBC_Handler;
    private static mapRom: MBC_Mapper = DefaultRomMapper;
    private static mapRam: MBC_Mapper = DefaultRamMapper;

    static Init(): void {
        MBC1.Init();
        const cartType = Cartridge.Data.cartridgeType;
        // MBC.currentType = cartType;
        assert(Cartridge.Data.romSizeByte <= 8, 'Unexpected Header ROM Size value: ' + Cartridge.Data.romSizeByte.toString());
        MBC.ramEnabled = cartType == CartridgeType.ROM_ONLY ? true : false;
        MBC.writeHandle = getHandler(cartType);
        MBC.mapRom = getRomMapper(cartType);
        MBC.mapRam = getRamMapper(cartType);
    }

    @inline
    static MapRom(gbAddress: u16): u32 {
        assert(gbAddress < 0x8000, 'Invalid ROM address: ' + uToHex<u16>(gbAddress));
        return MBC.mapRom(gbAddress);
    }

    @inline
    static MapRam(gbAddress: u16): u32 {
        assert(gbAddress >= 0xA000 && gbAddress < 0xC000, 'Invalid RAM address: ' + uToHex<u16>(gbAddress));
        if (!MBC.ramEnabled && Logger.verbose >= 1) {
            log('Warning, accessing RAM while disabled, at ' + uToHex<u16>(gbAddress));
        }
        return MBC.mapRam(gbAddress);
    }

    // @inline static get RomBank(): u16 { return MBC.romBank; }
    // @inline static get RamBank(): u16 { return MBC.ramBank; }

    // static set RomBank(value: u16) {
    //     if (Logger.verbose >= 2)
    //         log('Switching to ROM Bank #' + value);
    //     MBC.romBank = value;
    // }

    // static set RamBank(value: u8) {
    //     if (Logger.verbose >= 2)
    //         log('Switching to RAM Bank #' + value);
    //     MBC.ramBank = value;
    // }

    static enableRam(enabled: boolean = true): void {
        if (Logger.verbose >= 1)
            log(enabled ? 'Enabling RAM' : 'disabling RAM');
        MBC.ramEnabled = enabled;
        // TODO: save when disabled?
    }

    @inline
    static HandleWrite(gbAddress: u16, value: u8): void {
        MBC.writeHandle(gbAddress, value);
    }
}
