import { Logger } from "../debug/logger";
import { AudioChannel, AudioOutBuffer } from "./audioBuffer";

function log(s: string): void {
    Logger.Log("APU: " + s);
}

const freq: u32 = 44100;
const sampleDuration: f64 = 1 / freq;

const sineFreq = 880;
const sinePeriod: f64 = 1 / sineFreq;

@final
export class Audio {
    static outBuffer: AudioOutBuffer = new AudioOutBuffer();
    static outBufferIndex: i32 = 0;
    static timeSamples: u64;

    static Init(): void {
        if (Logger.verbose >= 3) {
            log('Initializing Audio');
        }
        Audio.outBufferIndex = 0;
        Audio.timeSamples = 0;
    }

    private static RenderSamples(numSamples: u32): void {
        const startI: i32 = <i32>Audio.timeSamples % AudioOutBuffer.BufferSize;
        const left: Float32Array = Audio.outBuffer.getWorkingBuffer(AudioChannel.Left);
        const right: Float32Array = Audio.outBuffer.getWorkingBuffer(AudioChannel.Right);
        if (Logger.verbose >= 2)
            log(`rendering ${numSamples} samples at ${startI} in buffer #${Audio.outBufferIndex} (${Audio.timeSamples}).`);

        const threshold = freq >> 1;
        for (let i: u32 = 0; i < numSamples; i++) {
            const t: u64 = (i + startI + Audio.timeSamples) / freq;
            const x: f32 = ((t % freq) > threshold) ? 1 : -1;
            left[startI + i] = x; // L
            right[startI + i] = x; // R
        }
    }

    static RenderFrame(timeMs: f64): void {
        const sampleCount = <i32>Math.round(timeMs * 44.1);
        if (Logger.verbose >= 2)
            log(`${sampleCount} samples = ${sampleCount >> 9} buffers of 512. i = ${Audio.outBufferIndex}`);
        let samplesToWrite = sampleCount
        while (samplesToWrite > 0) {
            const spaceLeft = AudioOutBuffer.BufferSize - Audio.outBufferIndex;
            const samplesThisBuffer = sampleCount > spaceLeft ? spaceLeft : sampleCount;
            Audio.timeSamples += samplesThisBuffer;
            Audio.RenderSamples(samplesThisBuffer);
            samplesToWrite -= samplesThisBuffer;
            if (spaceLeft <= samplesThisBuffer) {
                Audio.outBufferIndex = 0;
                if (!Audio.outBuffer.hasSpaceForNextBuffer()) {
                    log('Stop rendering audio: Queue Full');
                    break;
                }
                Audio.outBuffer.nextWorkingBuffers();
            } else {
                Audio.outBufferIndex += samplesThisBuffer;
            }
        }
        if (Logger.verbose >= 2)
            log(`wrote up to ${Audio.outBufferIndex} in buffer #${Audio.outBuffer.WorkingIndex}`);
    }
}

export function getAudioBuffersToReadCount(): u32 {
    return Audio.outBuffer.getBuffersToReadCount();
}

export function getAudioBuffersToReadSize(): u32 {
    return Audio.outBuffer.getBuffersToReadSize();
}

export function getAudioBufferToReadPointer(channel: AudioChannel): usize {
    return Audio.outBuffer.getBufferToReadPointer(channel);
}

export function markAudioBuffersRead(numBuffers: u32): void {
    Audio.outBuffer.markBuffersRead(numBuffers);
}

// export function audioFillBuffers(length: u32): void {
//     left = new Float32Array(length);
//     right = new Float32Array(length);
//     for (let i = 0; i < left.length; i++) {
//         left[i] = <f32>Math.random() * 2 - 1;
//     }
//     memory.copy(right.dataStart, left.dataStart, left.byteLength);
// }

// export function audioGetLeft(): Float32Array {
//     return left;
// }

// export function audioGetRight(): Float32Array {
//     return right;
// }
