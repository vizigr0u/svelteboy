import { LCD_WIDTH } from "./constants";

const DEFAULT_FIFO_CAPACITY: i32 = <i32>LCD_WIDTH * 2;

@final export class PixelFifo {
    private static data: StaticArray<u32> = new StaticArray<u32>(DEFAULT_FIFO_CAPACITY);
    private static headIndex: i32 = 0;
    private static tailIndex: i32 = -1;

    @inline
    static Clear(): void {
        PixelFifo.headIndex = 0;
        PixelFifo.tailIndex = -1;
    }

    @inline static HasEnoughPixels(): boolean { return PixelFifo.tailIndex - PixelFifo.headIndex >= 8 }
    @inline static get SpaceLeft(): i32 { return PixelFifo.IsEmpty() ? DEFAULT_FIFO_CAPACITY : DEFAULT_FIFO_CAPACITY - PixelFifo.tailIndex - 1 }

    // @inline private static IsFull(): boolean { return PixelFifo.tailIndex == DEFAULT_FIFO_CAPACITY - 1 }
    @inline private static IsEmpty(): boolean { return PixelFifo.tailIndex < PixelFifo.headIndex }

    static Enqueue(value: u32): void {
        unchecked(PixelFifo.data[++PixelFifo.tailIndex] = value);
        if (PixelFifo.headIndex == -1)
            PixelFifo.headIndex = 0;
    }

    @inline
    static Dequeue(): u32 {
        return unchecked(PixelFifo.data[PixelFifo.headIndex++]);
    }
}