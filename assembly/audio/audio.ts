import { CYCLES_PER_SECOND } from "../constants";
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
        if (Logger.verbose >= 2) {
            log('Initializing Audio');
        }
        Audio.timeSamples = 0;
        Audio.sinPhase = 0;
        if (Logger.verbose >= 3) {
            const leftP = Audio.outBuffer.getWorkingBuffer(AudioChannel.Left).dataStart;
            const rightP = Audio.outBuffer.getWorkingBuffer(AudioChannel.Right).dataStart;
            log(`Out Buffers starting at ${leftP} and ${rightP}\n`);
            log(Audio.outBuffer.PrintParams())
        }
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
            if (Logger.verbose >= 4) {
                log(`left[${bufferIndex + i}] = ${x} (at ${left.dataStart + bufferIndex + i})`);
                log(`right[${bufferIndex + i}] = ${x} (at ${right.dataStart + bufferIndex + i})`);
            }
            Audio.sinPhase += angularFreq;
            if (Audio.sinPhase >= 2.0 * Math.PI) {
                if (Logger.verbose >= 2) {
                    log(`(at ${bufferIndex + i}) SinPhase from ${Audio.sinPhase} to ${Audio.sinPhase - (2.0 * Math.PI)}`)
                }
                Audio.sinPhase -= 2.0 * Math.PI;
            }
        }
    }

    static RenderCycles(t_cycles: u64): void {
        let samplesToWrite: i32 = <i32>Math.round((<f64>t_cycles * SampleRate) / <f64>CYCLES_PER_SECOND);
        if (Logger.verbose >= 2)
            log(`${samplesToWrite} samples = ${samplesToWrite >> 9} buffers of ${AudioOutBuffer.BufferSize}. i = ${Audio.timeSamples}`);
        while (samplesToWrite > 0) {
            const bufferIndex: i32 = <i32>Audio.timeSamples % AudioOutBuffer.BufferSize;
            const spaceLeft = AudioOutBuffer.BufferSize - bufferIndex;
            const samplesThisBuffer = samplesToWrite > spaceLeft ? spaceLeft : samplesToWrite;
            Audio.RenderSamples(bufferIndex, <i32>samplesThisBuffer);
            Audio.timeSamples += samplesThisBuffer;
            samplesToWrite -= samplesThisBuffer;
            if (Logger.verbose >= 3) {
                log(Audio.outBuffer.PrintIndices(AudioChannel.Left, 63));
                log(Audio.outBuffer.PrintIndices(AudioChannel.Left, 64));
            }
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
