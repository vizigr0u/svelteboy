function test1(start: u32, length: u32): boolean {
    for (let i: u32 = start; i < length; i++) {
        store<u8>(i, <u8>(i % 0x100));
    }
    for (let i: u32 = start; i < length; i++) {
        if (<u8>(i % 0x100) != load<u8>(i))
            return false;
    }
    return true;
}

function test2(start: u32, length: u32): boolean {
    let buf1 = new Uint8Array(length);
    for (let i: u32 = 0; i < length; i++) {
        buf1[i] = <u8>(i % 0x100);
    }
    memory.copy(start, buf1.dataStart, length);
    let buf2 = new Uint8Array(length);
    memory.copy(buf2.dataStart, start, length);
    for (let i: u32 = 0; i < length; i++) {
        if (<u8>(i % 0x100) != buf2[i])
            return false;
    }
    // let buf2 = new Uint8Array(length);
    return true;
    // memory.copy(buf2.dataStart, start, length);
    // return memory.compare(buf1.dataStart, buf2.dataStart, length) == 0;
}

export function testMemory(): boolean {
    assert(test1(0, 200));
    assert(test1(0, 10));
    assert(test1(5000, 1000));
    assert(test2(0, 1024));
    assert(test2(5000, 1000));
    return true;
}
