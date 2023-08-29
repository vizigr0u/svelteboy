export class InlinedArray<T> {
    [key: i32]: T
    private internal: StaticArray<u8>

    constructor(size: i32) {
        if (!isReference<T>() || isManaged<T>()) {
            ERROR("InlinedArray only stores unmanaged objects")
        }

        this.internal = new StaticArray<u8>(size * offsetof<T>())
    }

    @inline get length(): i32 { return this.internal.length; }

    @operator("[]")
    __get(i: i32): T {
        return changetype<T>(changetype<usize>(this.internal) + i * offsetof<T>())
    }

    @operator("[]=")
    __set(i: i32, value: T): void {
        memory.copy(changetype<usize>(this.internal) + i * offsetof<T>(), changetype<usize>(value), offsetof<T>());
    }
}

export class InlinedReadonlyView<T> {
    [key: i32]: T
    private pointer: usize
    private size: i32

    constructor(dataStart: usize, length: i32) {
        if (!isReference<T>() || isManaged<T>()) {
            ERROR("InlinedArray only stores unmanaged objects")
        }

        this.pointer = dataStart
        this.size = length
    }

    @inline get length(): i32 { return this.size; }

    @operator("[]")
    __get(i: i32): T {
        if (i < 0)
            i += this.size
        assert(i >= 0 && i < this.size, 'InlinedReadonlyView: Index out of bounds')
        return changetype<T>(this.pointer + i * offsetof<T>())
    }

    @operator("{}")
    __unchecked_get(i: i32): T {
        return changetype<T>(changetype<usize>(this.pointer) + i * offsetof<T>())
    }
}
