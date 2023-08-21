import { ByteReader } from "./utils/bytereader";

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

@unmanaged
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
        let reader = new ByteReader(rom);
        reader.seek(0x134);
        let mt = new Metadata();
        mt.title = reader.readString(16);
        mt.cgbFlag = Uint8Array.wrap(rom)[0x143];
        mt.newLicenseeCode = reader.read2Bytes();
        mt.sgbFlag = reader.readByte();
        mt.cartridgeType = reader.readByte();
        mt.romSize = reader.readByte();
        mt.ramSize = reader.readByte();
        mt.destinationFlag = reader.readByte();
        mt.oldLicenseeCode = reader.readByte();
        mt.maskRomVersionNumber = reader.readByte();
        mt.headerChecksum = reader.readByte();
        mt.globalChecksum = reader.read2Bytes();
        return mt;
    }
}

export function extractMetadata(rom: ArrayBuffer): Metadata {
    return Metadata.read(rom);
}