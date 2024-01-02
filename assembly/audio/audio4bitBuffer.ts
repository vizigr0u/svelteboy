export class audio4bitBuffer {
    [key: i32]: u8
    private internal: Uint8Array;

    constructor(size: i32) {
        this.internal = new Uint8Array((size + 1) >> 1);
    }

    @inline get Length(): i32 { return this.internal.length >> 1; }

    @inline get Buffer(): ArrayBuffer { return this.internal.buffer; }

    @operator("[]")
    __get(i: i32): u8 {
        const index8: i32 = i >> 1;
        assert(index8 >= 0 && index8 < this.internal.length);
        const shift: u8 = <u8>((i % 2) << 2);
        return (this.internal[index8] >> shift) & 0xF;
    }

    @operator("[]=")
    __set(i: i32, value: u8): void {
        assert(value <= 0xF);
        const index8: i32 = i >> 1;
        assert(index8 >= 0 && index8 < this.internal.length);
        const shift: u8 = <u8>((i % 2) << 2);
        var val: u8 = this.internal[index8];
        val &= 0b11110000 >> shift;
        val |= value << shift;
        this.internal[index8] = val;
    }

    static wrap(buffer: ArrayBuffer, byteOffset: i32, length: i32): audio4bitBuffer {
        const copy: audio4bitBuffer = new audio4bitBuffer(0);
        copy.internal = Uint8Array.wrap(buffer, byteOffset, length);
        return copy;
    }

    dump(): string {
        var s = `(${this.Length} in ${this.internal.length}B})[`;
        for (let i = 0; i < this.Length; i++) {
            s += `${this[i]}, `;
        }
        return s + ']';
    }
}