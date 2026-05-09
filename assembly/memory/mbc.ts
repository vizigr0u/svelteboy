import { Cartridge } from "../cartridge";
import { CartridgeType } from "../metadata";
import { GB_EXT_RAM_START } from "./memoryConstants";
import { MBC1 } from "./mbc1";
import { MBC2 } from "./mbc2";
import { MBC3 } from "./mbc3";
import { MBC5 } from "./mbc5";
import { NoMBC } from "./noMbc";

const enum MBCType {
    None = 0,
    MBC1 = 1,
    MBC2 = 2,
    MBC3 = 3,
    MBC5 = 4,
}

function getType(t: CartridgeType): i32 {
    switch (t) {
        case CartridgeType.ROM_ONLY:
            return MBCType.None;
        case CartridgeType.MBC1:
        case CartridgeType.MBC1_RAM:
        case CartridgeType.MBC1_RAM_BATTERY:
            return MBCType.MBC1;
        case CartridgeType.MBC2:
        case CartridgeType.MBC2_BATTERY:
            return MBCType.MBC2;
        case CartridgeType.MBC3_TIMER_BATTERY:
        case CartridgeType.MBC3_TIMER_RAM_BATTERY_2:
        case CartridgeType.MBC3:
        case CartridgeType.MBC3_RAM_2:
        case CartridgeType.MBC3_RAM_BATTERY_2:
            return MBCType.MBC3;
        case CartridgeType.MBC5:
        case CartridgeType.MBC5_RAM:
        case CartridgeType.MBC5_RAM_BATTERY:
        case CartridgeType.MBC5_RUMBLE:
        case CartridgeType.MBC5_RUMBLE_RAM:
        case CartridgeType.MBC5_RUMBLE_RAM_BATTERY:
            return MBCType.MBC5;
        case CartridgeType.MBC6:
        case CartridgeType.MBC7_SENSOR_RUMBLE_RAM_BATTERY:
        case CartridgeType.POCKET_CAMERA:
        case CartridgeType.BANDAI_TAMA5:
        case CartridgeType.HuC3:
        case CartridgeType.HuC1_RAM_BATTERY:
        default:
            return MBCType.MBC1;
    }
}

@final
export class MBC {
    private static type: i32 = MBCType.None;
    static rom0Base: u32 = 0;
    static rom1Base: u32 = 0;
    static extRamBase: u32 = GB_EXT_RAM_START;
    static extRamMask: u32 = 0x1FFF;

    static Init(): void {
        assert(Cartridge.Data.romSizeByte <= 8, 'Unexpected Header ROM Size value: ' + Cartridge.Data.romSizeByte.toString());
        const t = getType(Cartridge.Data.cartridgeType);
        MBC.type = t;
        switch (t) {
            case MBCType.None: NoMBC.Init(); break;
            case MBCType.MBC1: MBC1.Init(); break;
            case MBCType.MBC2: MBC2.Init(); break;
            case MBCType.MBC3: MBC3.Init(); break;
            case MBCType.MBC5: MBC5.Init(); break;
            default: MBC1.Init(); break;
        }
        // Each MBC.Init() above sets MBC.extRamMask and calls Recache().
    }

    @inline
    static HandleWrite(gbAddress: u16, value: u8): void {
        switch (MBC.type) {
            case MBCType.None: NoMBC.HandleWrite(gbAddress, value); break;
            case MBCType.MBC1: MBC1.HandleWrite(gbAddress, value); break;
            case MBCType.MBC2: MBC2.HandleWrite(gbAddress, value); break;
            case MBCType.MBC3: MBC3.HandleWrite(gbAddress, value); break;
            case MBCType.MBC5: MBC5.HandleWrite(gbAddress, value); break;
            default: MBC1.HandleWrite(gbAddress, value); break;
        }
        // Each MBC.HandleWrite above calls its own Recache() at the end.
    }

    static Recache(): void {
        switch (MBC.type) {
            case MBCType.None: NoMBC.Recache(); break;
            case MBCType.MBC1: MBC1.Recache(); break;
            case MBCType.MBC2: MBC2.Recache(); break;
            case MBCType.MBC3: MBC3.Recache(); break;
            case MBCType.MBC5: MBC5.Recache(); break;
            default: MBC1.Recache(); break;
        }
    }

    @inline
    static MapRom(gbAddress: u16): u32 {
        return gbAddress < 0x4000
            ? MBC.rom0Base + <u32>gbAddress
            : MBC.rom1Base + (<u32>gbAddress - 0x4000);
    }

    @inline
    static MapRam(gbAddress: u16): u32 {
        return MBC.extRamBase + ((<u32>gbAddress - 0xA000) & MBC.extRamMask);
    }
}
