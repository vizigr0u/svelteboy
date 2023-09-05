import { PixelFifo } from "../io/video/pixelFifo";

export function testPixelFifo(): boolean {
    PixelFifo.Clear();
    assert(PixelFifo.SpaceLeft > 0);
    PixelFifo.Enqueue(1);
    PixelFifo.Enqueue(2);
    PixelFifo.Enqueue(3);
    PixelFifo.Enqueue(4);
    assert(PixelFifo.Dequeue() == 1);
    assert(PixelFifo.Dequeue() == 2);
    assert(PixelFifo.Dequeue() == 3);
    assert(PixelFifo.Dequeue() == 4);
    return true;
}
