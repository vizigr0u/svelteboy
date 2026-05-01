// Single-producer/single-consumer SAB ring buffer for stereo f32 audio frames.
// Producer (main thread) writes via SabWriter; consumer (AudioWorklet) reads via SabReader.
//
// Layout:
//   header  : 2 × Int32 (READ_IDX, WRITE_IDX) — frame indices, monotonically increasing mod 2^32
//   left    : capacity × Float32
//   right   : capacity × Float32
//
// Capacity must be a power of 2 that divides 2^32 so index wrap matches mask.

export const READ_IDX = 0;
export const WRITE_IDX = 1;

function isPow2(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
}

export const SabRing = {
    HEADER_BYTES: 8,
    LEFT_OFFSET: 8,
    rightOffset(capacity: number): number {
        return SabRing.HEADER_BYTES + capacity * 4;
    },
    bytesFor(capacity: number): number {
        return SabRing.HEADER_BYTES + capacity * 2 * 4;
    },
    allocate(capacity: number): SharedArrayBuffer {
        if (!isPow2(capacity)) throw new Error(`SabRing capacity must be power of 2, got ${capacity}`);
        return new SharedArrayBuffer(SabRing.bytesFor(capacity));
    },
};

class RingBase {
    protected header: Int32Array;
    protected left: Float32Array;
    protected right: Float32Array;
    protected mask: number;
    constructor(protected sab: SharedArrayBuffer, protected capacity: number) {
        if (!isPow2(capacity)) throw new Error(`capacity not power of 2: ${capacity}`);
        this.header = new Int32Array(sab, 0, 2);
        this.left = new Float32Array(sab, SabRing.LEFT_OFFSET, capacity);
        this.right = new Float32Array(sab, SabRing.rightOffset(capacity), capacity);
        this.mask = capacity - 1;
    }

    availableRead(): number {
        const w = Atomics.load(this.header, WRITE_IDX);
        const r = Atomics.load(this.header, READ_IDX);
        return (w - r) | 0;
    }

    availableWrite(): number {
        return this.capacity - this.availableRead();
    }
}

export class SabWriter extends RingBase {
    write(left: Float32Array, right: Float32Array): number {
        const n = Math.min(left.length, right.length);
        if (n === 0) return 0;

        let r = Atomics.load(this.header, READ_IDX);
        const w = Atomics.load(this.header, WRITE_IDX);
        const used = (w - r) | 0;
        const free = this.capacity - used;

        let srcOff = 0;
        let count = n;
        if (n > this.capacity) {
            // Source bigger than ring; only the tail can possibly survive.
            srcOff = n - this.capacity;
            count = this.capacity;
        }
        // Drop oldest if not enough room.
        const need = count - (this.capacity - ((w - r) | 0));
        if (need > 0) {
            r = (r + need) | 0;
            Atomics.store(this.header, READ_IDX, r);
        }
        // Suppress unused-var lint for `free`.
        void free;

        const start = w & this.mask;
        const tailRoom = this.capacity - start;
        const first = Math.min(count, tailRoom);
        this.left.set(left.subarray(srcOff, srcOff + first), start);
        this.right.set(right.subarray(srcOff, srcOff + first), start);
        if (first < count) {
            this.left.set(left.subarray(srcOff + first, srcOff + count), 0);
            this.right.set(right.subarray(srcOff + first, srcOff + count), 0);
        }

        Atomics.store(this.header, WRITE_IDX, (w + count) | 0);
        return count;
    }

    reset(): void {
        Atomics.store(this.header, READ_IDX, 0);
        Atomics.store(this.header, WRITE_IDX, 0);
    }
}

export class SabReader extends RingBase {
    read(outL: Float32Array, outR: Float32Array, n: number): number {
        const want = Math.min(n, outL.length, outR.length);
        if (want === 0) return 0;
        const w = Atomics.load(this.header, WRITE_IDX);
        const r = Atomics.load(this.header, READ_IDX);
        const avail = (w - r) | 0;
        const toRead = Math.min(want, avail);
        if (toRead === 0) return 0;

        const start = r & this.mask;
        const tailRoom = this.capacity - start;
        const first = Math.min(toRead, tailRoom);
        outL.set(this.left.subarray(start, start + first), 0);
        outR.set(this.right.subarray(start, start + first), 0);
        if (first < toRead) {
            outL.set(this.left.subarray(0, toRead - first), first);
            outR.set(this.right.subarray(0, toRead - first), first);
        }
        Atomics.store(this.header, READ_IDX, (r + toRead) | 0);
        return toRead;
    }
}
