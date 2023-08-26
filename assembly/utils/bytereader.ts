@final
export class ByteReader {
    index: u32;
    buffer: Uint8ClampedArray;

    constructor(buffer: ArrayBuffer) {
        this.index = 0;
        this.buffer = Uint8ClampedArray.wrap(buffer);
    }

    readBytes(numBytes: u32): Uint8ClampedArray {
        let result = this.buffer.slice(this.index, this.index + numBytes);
        this.index += numBytes;
        return result;
    }

    read<T>(): T {
        this.index += offsetof<T>();
        return load<T>(this.buffer.dataStart + this.index);
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
