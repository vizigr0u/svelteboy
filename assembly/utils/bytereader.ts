import { Logger } from "../debug/logger";
import { uToHex } from "./stringUtils";

function log(s: string): void {
    Logger.Log("ROM: " + s);
}

@final
export class ByteReader {
    index: u32;
    buffer: Uint8ClampedArray;

    constructor(buffer: ArrayBuffer) {
        this.index = 0;
        this.buffer = Uint8ClampedArray.wrap(buffer);
    }

    readBytes(numBytes: u32): Uint8ClampedArray {
        if (Logger.verbose >= 4) {
            log(`Read ${numBytes} bytes at ${uToHex<u16>(<u16>this.index)}`);
        }
        let result = this.buffer.slice(this.index, this.index + numBytes);
        this.index += numBytes;
        return result;
    }

    read<T>(): T {
        if (Logger.verbose >= 4) {
            log(`Read ${sizeof<T>()} bytes at ${uToHex<u16>(<u16>this.index)}`);
        }
        const res = load<T>(this.buffer.dataStart + this.index);
        this.index += sizeof<T>();
        return res;
    }

    readString(numBytes: u32): string {
        if (Logger.verbose >= 4) {
            log(`Read string of ${numBytes}B at ${uToHex<u16>(<u16>this.index)}`);
        }
        return String.UTF8.decode(this.readBytes(numBytes).buffer, true);
    }

    seek(index: u32): void {
        this.index = index >= 0 ? (index < <u32>this.buffer.byteLength ? index : this.buffer.byteLength - 1) : 0;
    }

    skip(numBytes: u32): void {
        this.seek(this.index + numBytes);
    }
}
