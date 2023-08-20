// import { FIFO_MAX_ELEMENTS } from "../../cpu/memoryMap";

const DEFAULT_FIFO_SIZE: u32 = 16;

@final export class Fifo<T> {
    headIndex: i8 = -1;
    tailIndex: i8 = -1;
    length: u8;
    // _dataStart: usize = 0;
    data: StaticArray<T>;

    // I just wanted to do something overly complicated and use direct access instead of allocating an array
    // @inline static Get(): Fifo { return changetype<Fifo>(<usize>FIFO_START); }

    // @inline capacity(): u8 { return FIFO_MAX_ELEMENTS; }
    // @inline at(index: u8): u8 { return load<u8>(FIFO_START + offsetof<Fifo>('_dataStart') + index); }
    // @inline set(index: u8, value: u8): void { store<u8>(FIFO_START + offsetof<Fifo>('_dataStart') + index, value); }

    // static Init(): void {
    //     Fifo.Get().Reset();
    // }

    @inline capacity(): u32 { return this.data.length; }
    @inline head(): T { return this.headIndex == -1 ? <T>-1 : this.data[this.headIndex]; }
    @inline tail(): T { return this.tailIndex == -1 ? <T>-1 : this.data[this.tailIndex]; }

    constructor(capacity: u32 = DEFAULT_FIFO_SIZE) {
        this.data = new StaticArray<T>(capacity);
        this.Reset();
    }

    IsFull(): boolean {
        return (this.headIndex == 0 && this.tailIndex == this.capacity() - 1) ||
            ((this.tailIndex + 1) % this.capacity() == this.headIndex);
    }

    IsEmpty(): boolean {
        return this.headIndex == -1;
    }

    Reset(): void {
        this.headIndex = -1;
        this.tailIndex = -1;
        this.length = 0;
    }

    Enqueue(value: T): void {
        assert(!this.IsFull(), 'FIFO IS FULL');

        if (this.headIndex == -1) /* Insert First Element */ {
            this.headIndex = this.tailIndex = 0;
            this.data[this.tailIndex] = value;
            return;
        }
        if (this.tailIndex == this.capacity() - 1 && this.headIndex != 0) {
            this.tailIndex = 0;
            this.data[this.tailIndex] = value;
            return;
        }

        this.tailIndex++;
        this.length++;
        this.data[this.tailIndex] = value;
    }

    Dequeue(): T {
        assert(!this.IsEmpty(), 'FIFO IS EMPTY');

        const result: T = this.data[this.headIndex];
        if (this.headIndex == this.tailIndex) {
            this.headIndex = -1;
            this.tailIndex = -1;
        }
        else if (this.headIndex == this.capacity() - 1)
            this.headIndex = 0;
        else
            this.headIndex++;

        this.length--;
        return result;
    }
}