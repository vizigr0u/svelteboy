import { ByteReader } from "./utils/bytereader";

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
    static read(rom: ArrayBuffer): Metadata {
        let reader = new ByteReader(rom);
        reader.seek(0x134);
        let mt = new Metadata();
        mt.title = reader.readString(15);
        mt.cgbFlag = reader.readByte();
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