export enum AudioChannel {
    Left = 0,
    Right = 1
}

const NumChannels = 2;

const BufferSizeBits: u32 = 9;
const BufferSize: i32 = 1 << BufferSizeBits; // 512
const QueueSizeBits: i32 = 3;
const QueueSize: u32 = 1 << QueueSizeBits;
const QueueSizeMask: u32 = QueueSize - 1;
const TotalBufferSize: i32 = QueueSize * BufferSize;

export class AudioOutBuffer {
    @inline static get BufferSize(): i32 { return BufferSize; }

    [key: i32]: f32
    private data: StaticArray<Float32Array>;
    private toPlayIndex: i32 = 0;
    private workingIndex: i32 = 0;

    constructor() {
        this.data = new StaticArray<Float32Array>(NumChannels);
        for (let i = 0; i < NumChannels; i++) {
            this.data[i] = new Float32Array(TotalBufferSize);
        }
        this.toPlayIndex = 0;
        this.workingIndex = 0;
    }

    @inline get WorkingIndex(): i32 { return this.workingIndex };

    @inline hasSpaceForNextBuffer(): boolean {
        return ((this.workingIndex + 1) & QueueSizeMask) != this.toPlayIndex;
    }

    @inline getWorkingBuffer(channel: AudioChannel): Float32Array {
        return Float32Array.wrap(this.data[channel].buffer, this.workingIndex << BufferSizeBits, BufferSize);
    }

    @inline nextWorkingBuffers(): void {
        this.workingIndex = (this.workingIndex + 1) & QueueSizeMask;
    }

    @inline getBuffersToReadCount(): u32 {
        return this.toPlayIndex > this.workingIndex ? QueueSize - (this.toPlayIndex - this.workingIndex) : this.workingIndex - this.toPlayIndex;
    }

    @inline getBuffersToReadSize(): u32 {
        return this.getBuffersToReadCount() << BufferSizeBits;
    }

    @inline getBufferToReadPointer(channel: AudioChannel): usize {
        return this.data[channel].dataStart + (this.toPlayIndex << BufferSizeBits);
    }

    markBuffersRead(numBuffers: u32): void {
        assert(this.getBuffersToReadCount() >= numBuffers, 'Buffer underflow');
        this.toPlayIndex = (this.toPlayIndex + numBuffers) & QueueSizeMask;
        console.log("Advanced read buffer to " + this.toPlayIndex.toString())
    }
}
