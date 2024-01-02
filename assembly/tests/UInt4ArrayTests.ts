import { UInt4Array } from "../audio/UInt4Array";

function testCreation(): boolean {
    const b = new UInt4Array(10);
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
    const main = new UInt4Array(16);
    const a = UInt4Array.wrap(main.Buffer, 0, 2);
    const b = UInt4Array.wrap(main.Buffer, 2, 2);
    const c = UInt4Array.wrap(main.Buffer, 4, 2);
    const d = UInt4Array.wrap(main.Buffer, 6, 2);
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

export function testUInt4Array(): boolean {
    assert(testCreation());
    assert(testWrap());
    return true;
}
