import { Logger } from "../debug/logger";

export enum AudioChannel {
    Left = 0,
    Right = 1
}

function log(s: string): void {
    Logger.Log("APU OUT: " + s);
}

const NumChannels = 2;

const BufferLengthBits: u32 = 8;  // 256
const BufferByteLengthBits: u32 = BufferLengthBits + 2; // size of f32
const BufferLength: i32 = 1 << BufferLengthBits;
const BufferByteLength: i32 = 1 << BufferByteLengthBits;
const QueueSizeBits: i32 = 7;
const QueueSize: u32 = 1 << QueueSizeBits;
const QueueSizeMask: u32 = QueueSize - 1;
const TotalBufferSize: i32 = QueueSize * BufferLength;

export class AudioOutBuffer {
    @inline static get BufferSize(): i32 { return BufferLength; }

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

    PrintParams(): string {
        return `BufferLength: ${BufferLength}, BufferByteLength: ${BufferByteLength}, QueueSize: ${QueueSize}, TotalBufferSize: ${TotalBufferSize}`;
    }

    PrintIndices(channel: AudioChannel, index: i32): string {
        let s = '';
        for (let i = 0; i < <i32>QueueSize; i++) {
            s += `${channel == 0 ? 'L' : 'R'} #${i}[${index}] = ${this.data[channel][(i << BufferLengthBits) + index]}, `
        }
        return s;
    }

    @inline get WorkingIndex(): i32 { return this.workingIndex };

    @inline hasSpaceForNextBuffer(): boolean {
        return ((this.workingIndex + 1) & QueueSizeMask) != this.toPlayIndex;
    }

    @inline getWorkingBuffer(channel: AudioChannel): Float32Array {
        return Float32Array.wrap(this.data[channel].buffer, (this.workingIndex << BufferByteLengthBits), BufferLength);
    }

    @inline nextWorkingBuffers(): void {
        this.workingIndex = (this.workingIndex + 1) & QueueSizeMask;
    }

    @inline getBuffersToReadCount(): u32 {
        return this.toPlayIndex > this.workingIndex ? QueueSize - (this.toPlayIndex - this.workingIndex) : this.workingIndex - this.toPlayIndex;
    }

    @inline getBufferToReadPointer(channel: AudioChannel): usize {
        return this.data[channel].dataStart + (this.toPlayIndex << BufferByteLengthBits);
    }

    markBuffersRead(numBuffers: u32): void {
        assert(this.getBuffersToReadCount() >= numBuffers, 'Buffer underflow');
        this.toPlayIndex = (this.toPlayIndex + numBuffers) & QueueSizeMask;
        if (Logger.verbose >= 2)
            log("Advanced read buffer to " + this.toPlayIndex.toString())
    }
}
