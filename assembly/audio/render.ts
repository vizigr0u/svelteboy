import { CYCLES_PER_SECOND } from "../constants";
import { Cpu } from "../cpu/cpu";
import { Logger } from "../debug/logger";
import { MemoryMap } from "../memory/memoryMap";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { AudioOutBuffer } from "./audioBuffer";
import { SoundDataPtr, SoundDataSize } from "./audioRegisters";
import { AudioChannel, AudioEvent, AudioRegisterType } from "./audioTypes";
import { AudioEventQueue } from "./eventQueue";

const SAMPLE_RATE: f64 = 44100;
const SamplesPerMs: f64 = SAMPLE_RATE / 1000;
const sampleDuration: f64 = 1 / SAMPLE_RATE;

const sineFreq = 440;
const sinePeriod: f64 = 1 / sineFreq;

@final
export class AudioRender {
    static AudioOn: boolean = false;
    static outBuffer: AudioOutBuffer = new AudioOutBuffer();
    static localData: Uint8Array = new Uint8Array(SoundDataSize);
    static channelSound: Uint8Array = new Uint8Array(AudioOutBuffer.BufferSize * 4);
    static c1Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 0 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static c2Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 1 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static c3Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 2 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static c4Sound: Uint8Array = Uint8Array.wrap(AudioRender.channelSound.buffer, 3 * AudioOutBuffer.BufferSize, AudioOutBuffer.BufferSize);
    static sampleIndex: u64;
    static initialCycles: u64;

    static sinPhase: f64 = 0;

    static Init(): void {
        AudioRender.sampleIndex = 0;
        AudioRender.sinPhase = 0;
        AudioRender.initialCycles = 0;
        AudioRender.AudioOn = MemoryMap.useBootRom ? false : true;
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
        const cycleDiff: u32 = <u32>(Cpu.CycleCount - AudioRender.initialCycles);
        const frameSampleIndex: u32 = <u32>Math.round((cycleDiff * SAMPLE_RATE) / CYCLES_PER_SECOND);
        return AudioEventQueue.Enqueue(frameSampleIndex, type, value);
    }

    private static RenderSamples(bufferStart: i32, numSamples: i32, sampleOffset: i32): void {
        const bufferEnd: i32 = bufferStart + numSamples;

        if (Logger.verbose >= 2)
            log(`rendering ${numSamples} samples at ${bufferStart} in buffer #${AudioRender.outBuffer.WorkingIndex}.`);
        let start: i32 = bufferStart;
        let end: i32 = bufferStart;

        const angularFreq: f64 = 2 * Math.PI * sineFreq / SAMPLE_RATE;

        if (true) {
            while (end < bufferEnd) {
                end = bufferEnd;
                if (!AudioEventQueue.IsEmpty()) {
                    const nextEventBufferIndex = <i32>AudioEventQueue.Peek().FrameSampleIndex - sampleOffset;
                    if (nextEventBufferIndex < end) {
                        end = nextEventBufferIndex;
                    }
                }

                assert(end >= 0 && end <= AudioRender.c1Sound.length, `AudioRender.c1Sound.length = ${AudioRender.c1Sound.length} start = ${start} end = ${end} AudioEventQueue.Peek().SampleIndex = ${AudioEventQueue.Peek().FrameSampleIndex} sampleOffset = ${sampleOffset}`);
                if (Logger.verbose >= 2) // TODO: tone down
                    log(`fill buffer from ${start} to ${end}`);
                for (let i: i32 = start; i < end; i++) {
                    // Render channels
                    assert(i >= 0 && i < AudioRender.c1Sound.length, `i = ${i} start = ${start} end = ${end}`);
                    const x: u8 = <f32>(Math.sin(AudioRender.sinPhase)) >= 0 ? 0xF : 0;
                    AudioRender.c1Sound[i] = AudioRender.AudioOn ? x : 0;
                    if (Logger.verbose >= 2) // TODO: tone down
                        log(`c1Sound[${i}] = ${uToHex<u8>(AudioRender.c1Sound[i])}`);
                    AudioRender.sinPhase += angularFreq;
                    if (AudioRender.sinPhase >= 2.0 * Math.PI) {
                        if (Logger.verbose >= 2) {
                            log(`(at ${bufferStart + i}) SinPhase from ${AudioRender.sinPhase} to ${AudioRender.sinPhase - (2.0 * Math.PI)}`)
                        }
                        AudioRender.sinPhase -= 2.0 * Math.PI;
                    }
                }
                start = end;
                if (end < bufferEnd) {
                    const ev = AudioEventQueue.Dequeue();
                    if (Logger.verbose >= 2)
                        log("Dequeue at " + start.toString());
                    AudioRender.ApplyEvent(ev);
                }
            }
        }


        const left: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
        const right: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);

        for (let i: i32 = 0; i < numSamples; i++) {
            const x: f32 = (<f32>AudioRender.c1Sound[bufferStart + i] - 7.5) / 7.5;
            left[bufferStart + i] = x; // L
            right[bufferStart + i] = x; // R
            if (Logger.verbose >= 4) {
                log(`left[${bufferStart + i}] = ${x} (at ${left.dataStart + bufferStart + i})`);
                log(`right[${bufferStart + i}] = ${x} (at ${right.dataStart + bufferStart + i})`);
            }
        }
    }

    static ApplyEvent(ev: AudioEvent): void {
        const dataIndex: i32 = <i32>ev.Type - 0x10; // First register is at 0xFF10
        assert(dataIndex >= 0 && dataIndex < AudioRender.localData.length, `Unexpected data index: ${dataIndex} - data size: ${AudioRender.localData.length}`)
        AudioRender.localData[dataIndex] = ev.Value;
        if (ev.Type < <u8>AudioRegisterType.WaveStart) {
            const t = <AudioRegisterType>ev.Type;
            if (Logger.verbose >= 1) {
                log('Apply Event ' + uToHex<u8>(ev.Type));
            }
            switch (t) {
                case AudioRegisterType.NR10_C1Sweep:
                case AudioRegisterType.NR11_C1Length:
                case AudioRegisterType.NR12_C1Volume:
                case AudioRegisterType.NR13_C1PeriodLo:
                case AudioRegisterType.NR14_C1PeriodHi:
                case AudioRegisterType.NR21_C2Length:
                case AudioRegisterType.NR22_C2Volume:
                case AudioRegisterType.NR23_C2PeriodLo:
                case AudioRegisterType.NR24_C2PeriodHi:
                case AudioRegisterType.NR30_C3Enable:
                case AudioRegisterType.NR31_C3Length:
                case AudioRegisterType.NR32_C3Volume:
                case AudioRegisterType.NR33_C3PeriodLo:
                case AudioRegisterType.NR34_C3PeriodHi:
                case AudioRegisterType.NR41_C4Length:
                case AudioRegisterType.NR42_C4Volume:
                case AudioRegisterType.NR43_C4Freq:
                case AudioRegisterType.NR44_C4Control:
                case AudioRegisterType.NR50_Volume:
                case AudioRegisterType.NR51_Panning:
                    break;
                case AudioRegisterType.NR52_SoundOnOff:
                    AudioRender.AudioOn = (ev.Value & 0x80) != 0;
                    if (Logger.verbose >= 1) {
                        log('Sound ' + (AudioRender.AudioOn ? 'ON' : 'OFF'))
                    }
                    break;
                default:
                    assert(false, "Unexpected event type dequeued " + t.toString());
                    unreachable();
            }
        }
    }

    static Render(currentCycles: u64): void {
        const t_cycles: u64 = currentCycles - AudioRender.initialCycles;
        const samplesToWrite: i32 = <i32>Math.round((<f64>t_cycles * SAMPLE_RATE) / <f64>CYCLES_PER_SECOND);
        if (Logger.verbose >= 2)
            log(`${samplesToWrite} samples = ${samplesToWrite >> 9} buffers of ${AudioOutBuffer.BufferSize}.i = ${AudioRender.sampleIndex} `);
        if (Logger.verbose >= 1 && AudioEventQueue.Size > 0) { // TODO: tone down
            log('Event queued this time: ' + AudioEventQueue.Size.toString());
        }
        const initialSampleIndex: u64 = AudioRender.sampleIndex;
        let samplesLeftToWrite: i32 = samplesToWrite;
        while (samplesLeftToWrite > 0) {
            const bufferIndex: i32 = <i32>AudioRender.sampleIndex % AudioOutBuffer.BufferSize;
            const spaceLeft = AudioOutBuffer.BufferSize - bufferIndex;
            const samplesThisBuffer = samplesLeftToWrite > spaceLeft ? spaceLeft : samplesLeftToWrite;
            AudioRender.RenderSamples(bufferIndex, <i32>samplesThisBuffer, <i32>(AudioRender.sampleIndex - initialSampleIndex - bufferIndex));
            samplesLeftToWrite -= samplesThisBuffer;
            AudioRender.sampleIndex += samplesThisBuffer;
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
            log(`wrote up to ${AudioRender.sampleIndex} in buffer #${AudioRender.outBuffer.WorkingIndex} `);
    }
}

export function getAudioSampleRate(): f64 {
    return SAMPLE_RATE;
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
