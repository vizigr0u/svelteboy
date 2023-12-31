import { MemoryMap, loadRom } from "./memory/memoryMap";
import { CARTRIDGE_ROM_START, CARTRIDGE_ROM_SIZE } from "./memory/memoryConstants";
import { Logger } from "./debug/logger";
import { CGBModeNames, CartridgeTypeNames, getCartridgeTypeName } from "./debug/symbols";
import { CGBMode, CartridgeType, Metadata } from "./metadata";
import { uToHex } from "./utils/stringUtils";

const supportedTypes: CartridgeType[] = [CartridgeType.ROM_ONLY,
CartridgeType.MBC1, CartridgeType.MBC1_RAM, /*CartridgeType.MBC1_RAM_BATTERY,*/
CartridgeType.MBC2, /* CartridgeType.MBC2_BATTERY, */
CartridgeType.MBC3, CartridgeType.MBC3_RAM_2, /*CartridgeType.MBC3_RAM_BATTERY_2, CartridgeType.MBC3_TIMER_BATTERY, CartridgeType.MBC3_TIMER_RAM_BATTERY_2,*/
];

function log(s: string): void {
    Logger.Log("ROM: " + s);
}

@final
export class Cartridge {
    static Data: Metadata = new Metadata();

    static Load(cartridgeRom: ArrayBuffer): boolean {
        if (Logger.verbose >= 3)
            log('Loading cartridge Rom of size ' + cartridgeRom.byteLength.toString());

        if (!loadRom(Uint8Array.wrap(cartridgeRom), CARTRIDGE_ROM_START, CARTRIDGE_ROM_SIZE)) {
            if (Logger.verbose >= 1)
                log('Unable to load cartridge');
            return false;
        }

        const metadata = Metadata.read(cartridgeRom);
        if (Logger.verbose >= 2) {
            log(`Cartridge title: ${metadata.title}, type ${getCartridgeTypeName(metadata.cartridgeType)} - battery: ${metadata.HasBattery} - tech: ${CGBModeNames.get(metadata.getCGBMode()).toString()} (${uToHex(metadata.cgbFlag)})`);
        }

        if (metadata.cgbFlag == CGBMode.CGBOnly) {
            if (Logger.verbose >= 1)
                log('Warning Cartridge is for Gameboy Color only, which is unsupported.')
            // return false;
        }

        if (!supportedTypes.includes(metadata.cartridgeType) && Logger.verbose >= 1)
            log(`Warning: cartridge rom type ${getCartridgeTypeName(metadata.cartridgeType)} not supported yet`);

        if (Logger.verbose >= 3)
            log('Cartridge loaded');

        Cartridge.Data = metadata;
        MemoryMap.loadedCartridgeRomSize = cartridgeRom.byteLength;

        return true;
    }
}

export function loadCartridgeRom(cartridgeRom: ArrayBuffer): boolean {
    return Cartridge.Load(cartridgeRom);
}
