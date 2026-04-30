import { describe, it, expect } from 'vitest';
import { SabRing, SabWriter, SabReader } from './sabRingBuffer';

function makeRing(capacity: number) {
    const sab = SabRing.allocate(capacity);
    return {
        sab,
        capacity,
        writer: new SabWriter(sab, capacity),
        reader: new SabReader(sab, capacity),
    };
}

function fillRange(start: number, count: number, scale = 1): Float32Array {
    const a = new Float32Array(count);
    for (let i = 0; i < count; i++) a[i] = (start + i) * scale;
    return a;
}

describe('SabRing layout', () => {
    it('byteLength = HEADER_BYTES + capacity * 8', () => {
        const cap = 64;
        const sab = SabRing.allocate(cap);
        expect(sab.byteLength).toBe(SabRing.HEADER_BYTES + cap * 2 * 4);
    });

    it('rejects non-power-of-2 capacity', () => {
        expect(() => SabRing.allocate(100)).toThrow();
    });
});

describe('SabWriter / SabReader', () => {
    it('starts empty', () => {
        const { reader, writer } = makeRing(64);
        expect(writer.availableRead()).toBe(0);
        expect(writer.availableWrite()).toBe(64);
        const outL = new Float32Array(8), outR = new Float32Array(8);
        expect(reader.read(outL, outR, 8)).toBe(0);
    });

    it('writes and reads back the same data', () => {
        const { reader, writer } = makeRing(64);
        const left = fillRange(1, 16);
        const right = fillRange(101, 16);
        const written = writer.write(left, right);
        expect(written).toBe(16);
        expect(writer.availableRead()).toBe(16);

        const outL = new Float32Array(16), outR = new Float32Array(16);
        const read = reader.read(outL, outR, 16);
        expect(read).toBe(16);
        expect(Array.from(outL)).toEqual(Array.from(left));
        expect(Array.from(outR)).toEqual(Array.from(right));
        expect(writer.availableRead()).toBe(0);
    });

    it('partial read returns only available frames', () => {
        const { reader, writer } = makeRing(64);
        writer.write(fillRange(1, 4), fillRange(101, 4));
        const outL = new Float32Array(8), outR = new Float32Array(8);
        const read = reader.read(outL, outR, 8);
        expect(read).toBe(4);
        // Remaining slots should still be zero (untouched).
        expect(outL[4]).toBe(0);
        expect(outR[7]).toBe(0);
    });

    it('wraps around the ring across multiple write/read cycles', () => {
        const cap = 16;
        const { reader, writer } = makeRing(cap);
        const outL = new Float32Array(8), outR = new Float32Array(8);
        for (let cycle = 0; cycle < 10; cycle++) {
            const start = cycle * 100;
            writer.write(fillRange(start, 8), fillRange(start + 1000, 8));
            outL.fill(0); outR.fill(0);
            expect(reader.read(outL, outR, 8)).toBe(8);
            for (let i = 0; i < 8; i++) {
                expect(outL[i]).toBe(start + i);
                expect(outR[i]).toBe(start + 1000 + i);
            }
        }
    });

    it('drop-oldest policy when writer would lap reader', () => {
        const cap = 16;
        const { reader, writer } = makeRing(cap);
        // Fill to capacity with values 1..16
        writer.write(fillRange(1, cap), fillRange(101, cap));
        expect(writer.availableRead()).toBe(cap);
        // Write 8 more — must drop 8 oldest.
        writer.write(fillRange(1001, 8), fillRange(2001, 8));
        expect(writer.availableRead()).toBe(cap);

        const outL = new Float32Array(cap), outR = new Float32Array(cap);
        reader.read(outL, outR, cap);
        // Oldest 8 (values 1..8) should be gone; remaining = 9..16 then 1001..1008.
        expect(outL[0]).toBe(9);
        expect(outL[7]).toBe(16);
        expect(outL[8]).toBe(1001);
        expect(outL[15]).toBe(1008);
        expect(outR[0]).toBe(109);
        expect(outR[15]).toBe(2008);
    });

    it('write larger than capacity drops everything except the most recent', () => {
        const cap = 16;
        const { reader, writer } = makeRing(cap);
        writer.write(fillRange(1, cap), fillRange(101, cap));
        // Write 32 frames into a 16-frame ring.
        writer.write(fillRange(500, 32), fillRange(1500, 32));
        expect(writer.availableRead()).toBe(cap);

        const outL = new Float32Array(cap), outR = new Float32Array(cap);
        reader.read(outL, outR, cap);
        // Only the last 16 frames should be retained: values 516..531.
        for (let i = 0; i < cap; i++) {
            expect(outL[i]).toBe(500 + 16 + i);
            expect(outR[i]).toBe(1500 + 16 + i);
        }
    });

    it('write spanning wrap boundary preserves order', () => {
        const cap = 16;
        const { reader, writer } = makeRing(cap);
        // Advance write to near end.
        writer.write(fillRange(1, 12), fillRange(101, 12));
        const outL = new Float32Array(12), outR = new Float32Array(12);
        reader.read(outL, outR, 12);
        // Now write 8 spanning wrap (cap-12=4 free at tail, 8 at head).
        writer.write(fillRange(1000, 8), fillRange(2000, 8));
        const o2L = new Float32Array(8), o2R = new Float32Array(8);
        expect(reader.read(o2L, o2R, 8)).toBe(8);
        for (let i = 0; i < 8; i++) {
            expect(o2L[i]).toBe(1000 + i);
            expect(o2R[i]).toBe(2000 + i);
        }
    });

    it('reset zeroes indices', () => {
        const { reader, writer } = makeRing(64);
        writer.write(fillRange(1, 10), fillRange(1, 10));
        writer.reset();
        expect(writer.availableRead()).toBe(0);
        const outL = new Float32Array(10), outR = new Float32Array(10);
        expect(reader.read(outL, outR, 10)).toBe(0);
    });
});
