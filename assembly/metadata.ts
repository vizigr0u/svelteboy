import { Logger } from "./debug/logger";
import { ByteReader } from "./utils/bytereader";
import { uToHex } from "./utils/stringUtils";

export enum CartridgeType {
    ROM_ONLY = 0x00,
    MBC1 = 0x01,
    MBC1_RAM = 0x02,
    MBC1_RAM_BATTERY = 0x03,
    MBC2 = 0x05,
    MBC2_BATTERY = 0x06,
    ROM_RAM_1 = 0x08,
    ROM_RAM_BATTERY_1 = 0x09,
    MMM01 = 0x0B,
    MMM01_RAM = 0x0C,
    MMM01_RAM_BATTERY = 0x0D,
    MBC3_TIMER_BATTERY = 0x0F,
    MBC3_TIMER_RAM_BATTERY_2 = 0x10,
    MBC3 = 0x11,
    MBC3_RAM_2 = 0x12,
    MBC3_RAM_BATTERY_2 = 0x13,
    MBC5 = 0x19,
    MBC5_RAM = 0x1A,
    MBC5_RAM_BATTERY = 0x1B,
    MBC5_RUMBLE = 0x1C,
    MBC5_RUMBLE_RAM = 0x1D,
    MBC5_RUMBLE_RAM_BATTERY = 0x1E,
    MBC6 = 0x20,
    MBC7_SENSOR_RUMBLE_RAM_BATTERY = 0x22,
    POCKET_CAMERA = 0xFC,
    BANDAI_TAMA5 = 0xFD,
    HuC3 = 0xFE,
    HuC1_RAM_BATTERY = 0xFF,
};

export enum CGBMode {
    NonCGB = 0,
    PartialCGB = 0x80,
    CGBOnly = 0xC0,
}

function log(s: string): void {
    Logger.Log("ROM: " + s);
}

export class Metadata {
    title: string = "";
    cgbFlag: u8 = 0;
    newLicenseeCode: u16 = 0;
    sgbFlag: u8 = 0;
    cartridgeType: u8 = 0;
    romSize: u8 = 0;
    ramSize: u8 = 0;
    destinationFlag: u8 = 0;
    oldLicenseeCode: u8 = 0;
    maskRomVersionNumber: u8 = 0;
    headerChecksum: u8 = 0;
    globalChecksum: u16 = 0;

    getCGBMode(): CGBMode { return (this.cgbFlag == CGBMode.CGBOnly || this.cgbFlag == CGBMode.PartialCGB) ? this.cgbFlag : CGBMode.NonCGB };

    static read(rom: ArrayBuffer): Metadata {
        if (Logger.verbose >= 2)
            log('Extracting metadata from rom of size ' + rom.byteLength.toString());
        let reader = new ByteReader(rom);
        reader.seek(0x134);
        let mt = new Metadata();
        mt.title = reader.readString(16);
        if (Logger.verbose >= 4)
            log('title: ' + mt.title);
        mt.cgbFlag = reader.buffer[0x143];
        if (Logger.verbose >= 4)
            log('cgbFlag: ' + uToHex<u8>(mt.cgbFlag));
        mt.newLicenseeCode = reader.read<u16>();
        if (Logger.verbose >= 4)
            log('newLicenseeCode: ' + uToHex<u16>(mt.newLicenseeCode));
        mt.sgbFlag = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('sgbFlag: ' + uToHex<u8>(mt.sgbFlag));
        mt.cartridgeType = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('cartridgeType: ' + uToHex<u8>(mt.cartridgeType));
        mt.romSize = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('romSize: ' + uToHex<u8>(mt.romSize));
        mt.ramSize = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('ramSize: ' + uToHex<u8>(mt.ramSize));
        mt.destinationFlag = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('destinationFlag: ' + uToHex<u8>(mt.destinationFlag));
        mt.oldLicenseeCode = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('oldLicenseeCode: ' + uToHex<u8>(mt.oldLicenseeCode));
        mt.maskRomVersionNumber = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('maskRomVersionNumber: ' + uToHex<u8>(mt.maskRomVersionNumber));
        mt.headerChecksum = reader.read<u8>();
        if (Logger.verbose >= 4)
            log('headerChecksum: ' + uToHex<u8>(mt.headerChecksum));
        mt.globalChecksum = reader.read<u16>();
        if (Logger.verbose >= 4)
            log('globalChecksum: ' + uToHex<u16>(mt.globalChecksum));
        return mt;
    }
}

export function extractMetadata(rom: ArrayBuffer): Metadata {
    return Metadata.read(rom);
}