import { Fifo } from "../io/video/fifo";

function testIsEmpty(): void {
    Fifo.Init();
    const fifo = Fifo.Get();
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
    Fifo.Init();
    const fifo = Fifo.Get();
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

export function testFifo(): boolean {
    testIsEmpty();
    testIsFull();
    return true;
}