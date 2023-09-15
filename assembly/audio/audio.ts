import { Logger } from "../debug/logger";
import { AudioChannel, AudioOutBuffer } from "./audioBuffer";

function log(s: string): void {
    Logger.Log("APU: " + s);
}

const SampleRate: f64 = 44100;
const SamplesPerMs: f64 = SampleRate / 1000;
const sampleDuration: f64 = 1 / SampleRate;

const sineFreq = 440;
const sinePeriod: f64 = 1 / sineFreq;

@final
export class Audio {
    static outBuffer: AudioOutBuffer = new AudioOutBuffer();
    static timeSamples: u64;

    static sinPhase: f64 = 0;

    static Init(): void {
        if (Logger.verbose >= 3) {
            log('Initializing Audio');
        }
        Audio.timeSamples = 0;
    }

    private static RenderSamples(bufferIndex: i32, numSamples: i32): void {
        const left: Float32Array = Audio.outBuffer.getWorkingBuffer(AudioChannel.Left);
        const right: Float32Array = Audio.outBuffer.getWorkingBuffer(AudioChannel.Right);
        if (Logger.verbose >= 2)
            log(`rendering ${numSamples} samples at ${bufferIndex} in buffer #${Audio.outBuffer.WorkingIndex} (${Audio.timeSamples}).`);

        const angularFreq: f64 = 2 * Math.PI * sineFreq / SampleRate;
        for (let i: i32 = 0; i < numSamples; i++) {
            const x = <f32>(Math.sin(Audio.sinPhase));
            left[bufferIndex + i] = x; // L
            right[bufferIndex + i] = x; // R
            Audio.sinPhase += angularFreq;
            if (Audio.sinPhase >= 2 * Math.PI)
                Audio.sinPhase -= 2 * Math.PI;
        }
    }

    static RenderFrame(timeMs: f64): void {
        const sampleCount = <i32>Math.round(timeMs * SamplesPerMs);
        if (Logger.verbose >= 2)
            log(`${sampleCount} samples = ${sampleCount >> 9} buffers of ${AudioOutBuffer.BufferSize}. i = ${Audio.timeSamples}`);
        let samplesToWrite = sampleCount
        while (samplesToWrite > 0) {
            const bufferIndex: i32 = <i32>Audio.timeSamples % AudioOutBuffer.BufferSize;
            const spaceLeft = AudioOutBuffer.BufferSize - bufferIndex;
            const samplesThisBuffer = samplesToWrite > spaceLeft ? spaceLeft : samplesToWrite;
            Audio.timeSamples += samplesThisBuffer;
            Audio.RenderSamples(bufferIndex, <i32>samplesThisBuffer);
            samplesToWrite -= samplesThisBuffer;
            if (spaceLeft <= samplesThisBuffer) {
                if (!Audio.outBuffer.hasSpaceForNextBuffer()) {
                    log('Stop rendering audio: Queue Full');
                    break;
                }
                Audio.outBuffer.nextWorkingBuffers();
            }
        }
        if (Logger.verbose >= 2)
            log(`wrote up to ${Audio.timeSamples} in buffer #${Audio.outBuffer.WorkingIndex}`);
    }
}

export function getAudioSampleRate(): f64 {
    return SampleRate;
}

export function getAudioBuffersToReadCount(): u32 {
    return Audio.outBuffer.getBuffersToReadCount();
}

export function getAudioBuffersSize(): u32 {
    return AudioOutBuffer.BufferSize;
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
