import { TEST_SPACE_START } from "../memory/memoryConstants";
import { InlinedArray } from "../utils/inlinedArray";

@unmanaged
class TestStructA {
    a: u8;
    b: u8;
    c: u8;
    d: u8;
}

class TestClassA {
    a: u8;
    b: u8;
    c: u8;
    d: u8;
    constructor() { }
}

@unmanaged
class TestStructB {
    a: u8;
    /* b is aligned to offset + 1 */
    b: u16;
    c: u8;
}

class TestStructC {
    a: u16;
    b: u8;
    c: u8;
}

function testStructCopy(): boolean {
    const structA = new TestStructA();
    const data = <Array<u8>>[5, 42, 87, 12];
    memory.copy(changetype<usize>(structA), data.dataStart, offsetof<TestStructA>());
    assert(structA.a == data[0], `structA = ${structA.a.toString()}, expected ${data[0].toString()}`);
    assert(structA.b == data[1], `structA = ${structA.b.toString()}, expected ${data[1].toString()}`);
    assert(structA.c == data[2], `structA = ${structA.c.toString()}, expected ${data[2].toString()}`);
    assert(structA.d == data[3], `structA = ${structA.d.toString()}, expected ${data[3].toString()}`);
    return true;
}

function testClassCopy(): boolean {
    const classA = new TestClassA();
    const data = <Array<u8>>[5, 42, 87, 12];
    memory.copy(changetype<usize>(classA), data.dataStart, offsetof<TestClassA>());
    assert(classA.a == data[0], `classA = ${classA.a.toString()}, expected ${data[0].toString()}`);
    assert(classA.b == data[1], `classA = ${classA.b.toString()}, expected ${data[1].toString()}`);
    assert(classA.c == data[2], `classA = ${classA.c.toString()}, expected ${data[2].toString()}`);
    assert(classA.d == data[3], `classA = ${classA.d.toString()}, expected ${data[3].toString()}`);
    return true;
}

function testStruct2Copy(): boolean {
    const structB = new TestStructB();
    const data = <Array<u8>>[5, 0, 0, 0, 12];
    store<u16>(data.dataStart + 2, 0xF42F);
    memory.copy(changetype<usize>(structB), data.dataStart, offsetof<TestStructB>());
    assert(structB.a == 5, `structB = ${structB.a.toString()}, expected ${5}`);
    assert(structB.b == 0xF42F, `structB = ${structB.b.toString()}, expected ${0xF42F}`);
    assert(structB.c == 12, `structB = ${structB.c.toString()}, expected ${12}`);
    return true;
}

function testStruct3Copy(): boolean {
    const structB = new TestStructC();
    const data = <Array<u8>>[0, 0, 87, 12];
    store<u16>(data.dataStart, 0xF42F);
    memory.copy(changetype<usize>(structB), data.dataStart, offsetof<TestStructC>());
    assert(structB.a == 0xF42F, `structB = ${structB.a.toString()}, expected ${0xF42F}`);
    assert(structB.b == 87, `structB = ${structB.b.toString()}, expected ${87}`);
    assert(structB.c == 12, `structB = ${structB.c.toString()}, expected ${12}`);
    return true;
}

function testUnalignedStruct2Copy(): boolean {
    const structB = new TestStructB();
    const data = <Array<u8>>[0, 5, 0, 0, 0, 12];
    store<u16>(data.dataStart + 3, 0xF42F);
    memory.copy(changetype<usize>(structB), data.dataStart + 1, offsetof<TestStructB>());
    assert(structB.a == 5, `structB = ${structB.a.toString()}, expected ${5}`);
    assert(structB.b == 0xF42F, `structB = ${structB.b.toString()}, expected ${0xF42F}`);
    assert(structB.c == 12, `structB = ${structB.c.toString()}, expected ${12}`);
    return true;
}

function testStructDirectAccess(): boolean {
    const data = <Array<u8>>[5, 42, 87, 12];
    const sa = changetype<TestStructA>(<usize>(data.dataStart));
    assert(sa.a == data[0], `sa.a = ${sa.a.toString()}, expected ${data[0].toString()}`);
    assert(sa.b == data[1], `sa.b = ${sa.b.toString()}, expected ${data[1].toString()}`);
    assert(sa.c == data[2], `sa.c = ${sa.c.toString()}, expected ${data[2].toString()}`);
    assert(sa.d == data[3], `sa.d = ${sa.d.toString()}, expected ${data[3].toString()}`);
    sa.a = 16;
    sa.b += 1;
    sa.c++;
    sa.d--;
    assert(sa.a == data[0], `sa.a = ${sa.a.toString()}, expected ${data[0].toString()}`);
    assert(sa.b == data[1], `sa.b = ${sa.b.toString()}, expected ${data[1].toString()}`);
    assert(sa.c == data[2], `sa.c = ${sa.c.toString()}, expected ${data[2].toString()}`);
    assert(sa.d == data[3], `sa.d = ${sa.d.toString()}, expected ${data[3].toString()}`);
    return true;
}

function testStructInRamDirectAccess(): boolean {
    const address: usize = TEST_SPACE_START + 42;
    const data = <Array<u8>>[5, 42, 87, 12];
    memory.copy(address, data.dataStart, data.length);
    const sa = changetype<TestStructA>(address);
    assert(sa.a == data[0], `sa.a = ${sa.a.toString()}, expected ${data[0].toString()}`);
    assert(sa.b == data[1], `sa.b = ${sa.b.toString()}, expected ${data[1].toString()}`);
    assert(sa.c == data[2], `sa.c = ${sa.c.toString()}, expected ${data[2].toString()}`);
    assert(sa.d == data[3], `sa.d = ${sa.d.toString()}, expected ${data[3].toString()}`);
    sa.a = 16;
    sa.b += 1;
    sa.c++;
    sa.d--;
    assert(sa.a != data[0], `sa.a = ${sa.a.toString()}, expected ${data[0].toString()}`);
    assert(sa.b != data[1], `sa.b = ${sa.b.toString()}, expected ${data[1].toString()}`);
    assert(sa.c != data[2], `sa.c = ${sa.c.toString()}, expected ${data[2].toString()}`);
    assert(sa.d != data[3], `sa.d = ${sa.d.toString()}, expected ${data[3].toString()}`);
    memory.copy(data.dataStart, address, data.length);
    assert(sa.a == data[0], `sa.a = ${sa.a.toString()}, expected ${data[0].toString()}`);
    assert(sa.b == data[1], `sa.b = ${sa.b.toString()}, expected ${data[1].toString()}`);
    assert(sa.c == data[2], `sa.c = ${sa.c.toString()}, expected ${data[2].toString()}`);
    assert(sa.d == data[3], `sa.d = ${sa.d.toString()}, expected ${data[3].toString()}`);
    return true;
}

@unmanaged
class struct {
    a: u8; b: u8; c: u8; d: u8;
}

function setI(buffer: StaticArray<u8>, i: u32, s: struct): void {
    const st = changetype<struct>(changetype<usize>(buffer) + i * offsetof<struct>());
    st.a = s.a;
    st.b = s.b;
    st.c = s.c;
    st.d = s.d;
}

export function testStaticArrayOfStruct(): void {
    const buffer = new StaticArray<u8>(10 * offsetof<struct>());
    const pBuffer: usize = changetype<usize>(buffer);
    setI(buffer, 0, { a: 17, b: 42, c: 128, d: 99 });
    assert(changetype<StaticArray<u8>>(pBuffer + 0)[0] == 17);
    assert(load<u8>(pBuffer + 1) == 42);
    assert(changetype<struct>(pBuffer).c == 128);
    assert(changetype<struct>(pBuffer).d == 99);
}


export function testInlineArray(): void {
    const buffer = new InlinedArray<struct>(10);
    buffer[0] = { a: 17, b: 42, c: 128, d: 99 };
    buffer[1] = { a: 18, b: 43, c: 129, d: 100 };

    assert(buffer[0].a == 17);
    assert(buffer[0].b == 42);
    assert(buffer[0].c == 128);
    assert(buffer[0].d == 99);
    assert(buffer[1].a == 18);
    assert(buffer[1].b == 43);
    assert(buffer[1].c == 129);
    assert(buffer[1].d == 100);
}

export function testMisc(): boolean {
    assert(testStructCopy());
    assert(testClassCopy());
    assert(testStruct2Copy());
    assert(testStruct3Copy());
    assert(testUnalignedStruct2Copy());
    assert(testStructDirectAccess());
    assert(testStructInRamDirectAccess());
    testStaticArrayOfStruct();
    testInlineArray();
    return true;
}
