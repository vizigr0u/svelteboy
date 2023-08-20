import { Fifo } from "../io/video/fifo";

function testIsEmpty(): void {
    const fifo = new Fifo<u32>();
    assert(fifo.IsEmpty());
    fifo.Enqueue(1);
    fifo.Enqueue(2);
    fifo.Enqueue(3);
    fifo.Enqueue(4);
    assert(!fifo.IsEmpty());
    fifo.Dequeue();
    fifo.Dequeue();
    fifo.Dequeue();
    fifo.Dequeue();
    assert(fifo.IsEmpty());
}

function testIsFull(): void {
    const fifo = new Fifo<u32>();
    assert(!fifo.IsFull());
    for (let i: u8 = 0; i < fifo.capacity(); i++) {
        fifo.Enqueue(i);
    }
    assert(fifo.IsFull());
    fifo.Dequeue();
    assert(!fifo.IsFull());
    while (!fifo.IsEmpty()) {
        fifo.Dequeue();
    }
    assert(!fifo.IsFull());
    assert(fifo.IsEmpty());
}

function testHead(): void {
    const fifo = new Fifo<u32>();
    for (let i: u8 = 0; i < fifo.capacity(); i++) {
        fifo.Enqueue(i);
    }
    const lastElem = fifo.capacity() - 1;
    assert(fifo.Dequeue() == 0);
    assert(fifo.tail() == lastElem);
    assert(fifo.Dequeue() == 1);
    assert(fifo.tail() == lastElem);
    assert(fifo.Dequeue() == 2);
    assert(fifo.tail() == lastElem);
    while (!fifo.IsEmpty()) {
        fifo.Dequeue();
    }
    assert(fifo.head() == <u32>-1);
}

export function testFifo(): boolean {
    testIsEmpty();
    testIsFull();
    testHead();
    return true;
}