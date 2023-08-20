import { FIFO_MAX_ELEMENTS, FIFO_START } from "../../cpu/memoryMap";

@final export class Fifo {
    head: i8 = -1;
    tail: i8 = -1;
    _dataStart: usize = 0;

    @inline static getGlobalPointer(): usize { return <usize>(FIFO_START); }
    @inline static Get(): Fifo { return changetype<Fifo>(Fifo.getGlobalPointer()); }

    @inline capacity(): u8 { return FIFO_MAX_ELEMENTS; }
    @inline at(index: u8): u8 { return load<u8>(FIFO_START + offsetof<Fifo>('_dataStart') + index); }
    @inline set(index: u8, value: u8): void { store<u8>(FIFO_START + offsetof<Fifo>('_dataStart') + index, value); }

    static Init(): void {
        Fifo.Get().head = -1;
        Fifo.Get().tail = -1;
    }

    IsFull(): boolean {
        return (this.head == 0 && this.tail == this.capacity() - 1) ||
            ((this.tail + 1) % this.capacity() == this.head);
    }

    IsEmpty(): boolean {
        return this.head == -1;
    }

    Enqueue(value: u8): void {
        assert(!this.IsFull(), 'FIFO IS FULL');

        if (this.head == -1) /* Insert First Element */ {
            this.head = this.tail = 0;
            this.set(this.tail, value);
            return;
        }
        if (this.tail == this.capacity() - 1 && this.head != 0) {
            this.tail = 0;
            this.set(this.tail, value);
            return;
        }

        this.tail++;
        this.set(this.tail, value);
    }

    Dequeue(): u8 {
        assert(!this.IsEmpty(), 'FIFO IS EMPTY');

        const result: u8 = this.at(this.head);
        if (this.head == this.tail) {
            this.head = -1;
            this.tail = -1;
        }
        else if (this.head == this.capacity() - 1)
            this.head = 0;
        else
            this.head++;

        return result;
    }
}