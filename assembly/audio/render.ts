import { CYCLES_PER_SECOND } from "../constants";
import { Cpu } from "../cpu/cpu";
import { Logger } from "../debug/logger";
import { log } from "./apu";
import { AudioOutBuffer } from "./audioBuffer";
import { SoundDataPtr, SoundDataSize } from "./audioRegisters";
import { AudioChannel } from "./audioTypes";
import { AudioEventQueue } from "./eventQueue";

const SampleRate: f64 = 44100;
const SamplesPerMs: f64 = SampleRate / 1000;
const sampleDuration: f64 = 1 / SampleRate;

const sineFreq = 440;
const sinePeriod: f64 = 1 / sineFreq;

@final
export class AudioRender {
    static outBuffer: AudioOutBuffer = new AudioOutBuffer();
    static localData: Uint8Array = new Uint8Array(SoundDataSize);
    static channelSound: Uint8Array = new Uint8Array(AudioOutBuffer.BufferSize * 4);
    static c1Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 0 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static c2Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 1 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static c3Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 2 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static c4Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 3 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static timeSamples: u64;
    static initialCycles: u64;

    static sinPhase: f64 = 0;

    static Init(): void {
        AudioRender.timeSamples = 0;
        AudioRender.sinPhase = 0;
        AudioRender.initialCycles = 0;
        if (Logger.verbose >= 3) {
            const leftP = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left).dataStart;
            const rightP = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right).dataStart;
            log(`Out Buffers starting at ${leftP} and ${rightP}\n`);
            log(AudioRender.outBuffer.PrintParams())
        }
        memory.copy(AudioRender.localData.dataStart, SoundDataPtr, SoundDataSize);
    }

    static Prepare(initialCycles: u64): void {
        AudioEventQueue.Reset();
        AudioRender.initialCycles = initialCycles;
    }

    static EnqueueEvent(type: u8, value: u8): boolean {
        if (Logger.verbose >= 2) { // TODO: tone down
            log(`AudioEvent: ${type} = ${value}`);
        }
        return AudioEventQueue.Enqueue(<u32>(Cpu.CycleCount - AudioRender.initialCycles), type, value);
    }

    private static RenderSamples(bufferIndex: i32, numSamples: i32): void {
        const left: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
        const right: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);
        if (Logger.verbose >= 2)
            log(`rendering ${numSamples} samples at ${bufferIndex} in buffer #${AudioRender.outBuffer.WorkingIndex} (${AudioRender.timeSamples}).`);

        const angularFreq: f64 = 2 * Math.PI * sineFreq / SampleRate;
        for (let i: i32 = 0; i < numSamples; i++) {
            const x = <f32>(Math.sin(AudioRender.sinPhase));
            left[bufferIndex + i] = x; // L
            right[bufferIndex + i] = x; // R
            if (Logger.verbose >= 4) {
                log(`left[${bufferIndex + i}] = ${x} (at ${left.dataStart + bufferIndex + i})`);
                log(`right[${bufferIndex + i}] = ${x} (at ${right.dataStart + bufferIndex + i})`);
            }
            AudioRender.sinPhase += angularFreq;
            if (AudioRender.sinPhase >= 2.0 * Math.PI) {
                if (Logger.verbose >= 2) {
                    log(`(at ${bufferIndex + i}) SinPhase from ${AudioRender.sinPhase} to ${AudioRender.sinPhase - (2.0 * Math.PI)}`)
                }
                AudioRender.sinPhase -= 2.0 * Math.PI;
            }
        }
    }

    static Render(currentCycles: u64): void {
        const t_cycles: u64 = currentCycles - AudioRender.initialCycles;
        let samplesToWrite: i32 = <i32>Math.round((<f64>t_cycles * SampleRate) / <f64>CYCLES_PER_SECOND);
        if (Logger.verbose >= 2)
            log(`${samplesToWrite} samples = ${samplesToWrite >> 9} buffers of ${AudioOutBuffer.BufferSize}. i = ${AudioRender.timeSamples}`);
        if (Logger.verbose >= 1 && AudioEventQueue.Size > 0) { // TODO: tone down
            log('Event queued this time: ' + AudioEventQueue.Size.toString());
        }
        while (samplesToWrite > 0) {
            const bufferIndex: i32 = <i32>AudioRender.timeSamples % AudioOutBuffer.BufferSize;
            const spaceLeft = AudioOutBuffer.BufferSize - bufferIndex;
            const samplesThisBuffer = samplesToWrite > spaceLeft ? spaceLeft : samplesToWrite;
            AudioRender.RenderSamples(bufferIndex, <i32>samplesThisBuffer);
            AudioRender.timeSamples += samplesThisBuffer;
            samplesToWrite -= samplesThisBuffer;
            if (Logger.verbose >= 3) {
                log(AudioRender.outBuffer.PrintIndices(AudioChannel.Left, 63));
                log(AudioRender.outBuffer.PrintIndices(AudioChannel.Left, 64));
            }
            if (spaceLeft <= samplesThisBuffer) {
                if (!AudioRender.outBuffer.hasSpaceForNextBuffer()) {
                    log('Stop rendering audio: Queue Full');
                    break;
                }
                AudioRender.outBuffer.nextWorkingBuffers();
            }
        }
        if (Logger.verbose >= 2)
            log(`wrote up to ${AudioRender.timeSamples} in buffer #${AudioRender.outBuffer.WorkingIndex}`);
    }
}

export function getAudioSampleRate(): f64 {
    return SampleRate;
}

export function getAudioBuffersToReadCount(): u32 {
    return AudioRender.outBuffer.getBuffersToReadCount();
}

export function getAudioBuffersSize(): u32 {
    return AudioOutBuffer.BufferSize;
}

export function getAudioBufferToReadPointer(channel: AudioChannel): usize {
    return AudioRender.outBuffer.getBufferToReadPointer(channel);
}

export function markAudioBuffersRead(numBuffers: u32): void {
    AudioRender.outBuffer.markBuffersRead(numBuffers);
}
