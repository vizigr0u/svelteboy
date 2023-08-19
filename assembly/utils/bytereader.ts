@final
export class ByteReader {
    index: u32;
    buffer: Uint8ClampedArray;

    constructor(buffer: ArrayBuffer) {
        this.index = 0;
        this.buffer = Uint8ClampedArray.wrap(buffer);
    }

    readByte(): u8 {
        return this.buffer[this.index++];
    }

    readBytes(numBytes: u32): Uint8ClampedArray {
        let result = this.buffer.slice(this.index, this.index + numBytes);
        this.index += numBytes;
        return result;
    }

    read2Bytes(): u16 {
        let bytes = this.readBytes(2);
        this.index += 2;
        let arr = Uint16Array.wrap(bytes.buffer.slice());
        return arr[0];
    }

    readString(numBytes: u32): string {
        return String.UTF8.decode(this.readBytes(numBytes).buffer, true);
    }

    seek(index: u32): void {
        this.index = index >= 0 ? (index < <u32>this.buffer.byteLength ? index : this.buffer.byteLength - 1) : 0;
    }

    skip(numBytes: u32): void {
        this.seek(this.index + numBytes);
    }
}
