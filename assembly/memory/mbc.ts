import { Cartridge } from "../cartridge";
import { CartridgeType } from "../metadata";
import { MBC1_Handler } from "./mbc1";
import { MBC2_Handler } from "./mbc2";
import { MBC3_Handler } from "./mbc3";
import { MBC_Handler, MBC_Mapper, MBC_Write, log } from "./mbcTypes";
import { NoMBCHandler } from "./noMbc";

function getHandler(t: CartridgeType): MBC_Handler {
    switch (t) {
        case CartridgeType.ROM_ONLY:
            return NoMBCHandler;
        case CartridgeType.MBC1:
        case CartridgeType.MBC1_RAM:
        case CartridgeType.MBC1_RAM_BATTERY:
            return MBC1_Handler;
        case CartridgeType.MBC2:
        case CartridgeType.MBC2_BATTERY:
            return MBC2_Handler;
        case CartridgeType.MBC3_TIMER_BATTERY:
        case CartridgeType.MBC3_TIMER_RAM_BATTERY_2:
        case CartridgeType.MBC3:
        case CartridgeType.MBC3_RAM_2:
        case CartridgeType.MBC3_RAM_BATTERY_2:
            return MBC3_Handler;
        case CartridgeType.MBC5:
        case CartridgeType.MBC5_RAM:
        case CartridgeType.MBC5_RAM_BATTERY:
        case CartridgeType.MBC5_RUMBLE:
        case CartridgeType.MBC5_RUMBLE_RAM:
        case CartridgeType.MBC5_RUMBLE_RAM_BATTERY:
        case CartridgeType.MBC6:
        case CartridgeType.MBC7_SENSOR_RUMBLE_RAM_BATTERY:
        case CartridgeType.POCKET_CAMERA:
        case CartridgeType.BANDAI_TAMA5:
        case CartridgeType.HuC3:
        case CartridgeType.HuC1_RAM_BATTERY:
        default:
            return MBC1_Handler;
    }
}

@final
export class MBC {
    private static writeToRom: MBC_Write = NoMBCHandler.WriteToRom;
    private static mapRom: MBC_Mapper = NoMBCHandler.MapRom;
    private static mapRam: MBC_Mapper = NoMBCHandler.MapRam;

    static Init(): void {
        const cartType = Cartridge.Data.cartridgeType;
        assert(Cartridge.Data.romSizeByte <= 8, 'Unexpected Header ROM Size value: ' + Cartridge.Data.romSizeByte.toString());

        const handler = getHandler(cartType);
        handler.Init();

        MBC.writeToRom = handler.WriteToRom;
        MBC.mapRom = handler.MapRom;
        MBC.mapRam = handler.MapRam;
    }

    @inline
    static HandleWrite(gbAddress: u16, value: u8): void {
        MBC.writeToRom(gbAddress, value);
    }

    @inline
    static MapRom(gbAddress: u16): u32 {
        return MBC.mapRom(gbAddress);
    }

    @inline
    static MapRam(gbAddress: u16): u32 {
        return MBC.mapRam(gbAddress);
    }
}
