import { audio4bitBuffer } from "../audio/audio4bitBuffer";

function testCreation(): boolean {
    const b = new audio4bitBuffer(10);
    b[1] = 1;
    b[3] = 3;
    b[5] = 5;
    b[0] = 0;
    b[9] = 9;
    b[7] = 7;
    b[4] = 4;
    b[8] = 8;
    b[2] = 2;
    b[6] = 6;

    for (let i = 0; i < 10; i++) {
        assert(b[i] == i);
    }

    return true;
}

function testWrap(): boolean {
    const main = new audio4bitBuffer(16);
    const a = audio4bitBuffer.wrap(main.Buffer, 0, 2);
    const b = audio4bitBuffer.wrap(main.Buffer, 2, 2);
    const c = audio4bitBuffer.wrap(main.Buffer, 4, 2);
    const d = audio4bitBuffer.wrap(main.Buffer, 6, 2);
    for (let i = 0; i < 4; i++) {
        a[i] = <u8>i + 0 * 4;
        b[i] = <u8>i + 1 * 4;
        c[i] = <u8>i + 2 * 4;
        d[i] = <u8>i + 3 * 4;
    }

    for (let i = 0; i < 16; i++) {
        assert(main[i] == i);
    }

    return true;
}

export function test4BitBuffer(): boolean {
    assert(testCreation());
    assert(testWrap());
    return true;
}
