import { CYCLES_PER_SECOND } from "../constants";
import { Cpu } from "../cpu/cpu";
import { Logger } from "../debug/logger";
import { MemoryMap } from "../memory/memoryMap";
import { uToHex } from "../utils/stringUtils";
import { NoiseChannel } from "./NoiseChannel";
import { DutyCycle, PulseChannel } from "./PulseChannel";
import { log } from "./apu";
import { AudioOutBuffer } from "./audioBuffer";
import { SAMPLE_RATE, SoundDataPtr, SoundDataSize } from "./audioRegisters";
import { AudioChannel, AudioEvent, AudioRegisterType, getRegisterIndex } from "./audioTypes";
import { AudioEventQueue } from "./eventQueue";

import { OutputLevel, WaveChannel } from "./WaveChannel";
import { AudioData } from "./AudioData";

@final
export class AudioRender {
    static AudioOn: boolean = false;
    static outBuffer: AudioOutBuffer = new AudioOutBuffer();

    static channel1: PulseChannel = new PulseChannel(AudioData.channel1Buffer);
    static channel2: PulseChannel = new PulseChannel(AudioData.channel2Buffer);
    static channel3: WaveChannel = WaveChannel.Create(AudioData.channel3Buffer, AudioData.channel4Wave);
    static channel4: NoiseChannel = new NoiseChannel(AudioData.channel4Buffer);
    static sampleIndex: u64;
    static initialCycles: u64;

    static debugMute1: boolean = false;
    static debugMute2: boolean = false;
    static debugMute3: boolean = false;
    static debugMute4: boolean = false;

    static LeftVolume: f32 = 1.0;
    static RightVolume: f32 = 1.0;

    static Init(): void {
        AudioRender.channel1.Reset();
        AudioRender.channel2.Reset();
        AudioRender.channel3.Reset();
        AudioRender.channel4.Reset();
        AudioRender.sampleIndex = 0;
        AudioRender.initialCycles = 0;
        AudioRender.AudioOn = MemoryMap.useBootRom ? false : true;
        if (Logger.verbose >= 3) {
            const leftP = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left).dataStart;
            const rightP = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right).dataStart;
            log(`Out Buffers starting at ${leftP} and ${rightP}\n`);
            log(AudioRender.outBuffer.PrintParams())
        }
        memory.copy(AudioData.registers.dataStart, SoundDataPtr, SoundDataSize);
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

        if (true) {
            while (end < bufferEnd) {
                end = bufferEnd;
                if (!AudioEventQueue.IsEmpty()) {
                    const nextEventBufferIndex = <i32>AudioEventQueue.Peek().FrameSampleIndex - sampleOffset;
                    if (nextEventBufferIndex < end) {
                        end = nextEventBufferIndex;
                    }
                }

                assert(end >= 0 && end <= AudioOutBuffer.BufferSize, `AudioOutBuffer.BufferSize = ${AudioOutBuffer.BufferSize} start = ${start} end = ${end} AudioEventQueue.Peek().SampleIndex = ${AudioEventQueue.Peek().FrameSampleIndex} sampleOffset = ${sampleOffset}`);
                if (Logger.verbose >= 2) // TODO: tone down
                    log(`fill buffer from ${start} to ${end}`);

                AudioRender.channel1.Render(start, end);
                AudioRender.channel2.Render(start, end);
                AudioRender.channel3.Render(start, end);
                AudioRender.channel4.Render(start, end);

                if (AudioRender.AudioOn) {
                    AudioRender.RenderVolumes(start, end);
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

        AudioRender.MixChannels(bufferStart, numSamples);
    }

    static RenderVolumes(start: i32, end: i32): void {
        const left: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
        const right: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);
        for (let i: i32 = start; i < end; i++) {
            left[i] = AudioRender.LeftVolume;
            right[i] = AudioRender.RightVolume;
        }
    }

    static MixChannels(bufferStart: i32, numSamples: i32): void {
        const left: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
        const right: Float32Array = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);

        if (AudioRender.AudioOn) {
            const numChans: f32 = (AudioRender.channel1.Enabled ? 1.0 : 0.0) + (AudioRender.channel2.Enabled ? 1.0 : 0.0) + (AudioRender.channel3.Enabled ? 1.0 : 0.0) + (AudioRender.channel4.Enabled ? 1.0 : 0.0);
            const panning: u8 = AudioData.registers[getRegisterIndex(AudioRegisterType.NR51_Panning)];
            for (let i: i32 = 0; i < numSamples; i++) {
                let l: f32 = 0;
                let r: f32 = 0;
                if (AudioRender.channel1.Enabled && !AudioRender.debugMute1) {
                    const x = (<f32>AudioRender.channel1.Buffer[bufferStart + i] / 7.5) - 1.0;
                    l = ((panning & 0x10) != 0) ? x : 0;
                    r = ((panning & 0x1) != 0) ? x : 0;
                }
                if (AudioRender.channel2.Enabled && !AudioRender.debugMute2) {
                    const x = (<f32>AudioRender.channel2.Buffer[bufferStart + i] / 7.5) - 1.0;
                    l += ((panning & 0x20) != 0) ? x : 0;
                    r += ((panning & 0x2) != 0) ? x : 0;
                }
                if (AudioRender.channel3.Enabled && !AudioRender.debugMute3) {
                    const x = (<f32>AudioRender.channel3.Buffer[bufferStart + i] / 7.5) - 1.0;
                    l += ((panning & 0x40) != 0) ? x : 0;
                    r += ((panning & 0x4) != 0) ? x : 0;
                }
                if (AudioRender.channel4.Enabled && !AudioRender.debugMute4) {
                    const x = (<f32>AudioRender.channel4.Buffer[bufferStart + i] / 7.5) - 1.0;
                    l += ((panning & 0x80) != 0) ? x : 0;
                    r += ((panning & 0x8) != 0) ? x : 0;
                }

                left[bufferStart + i] *= l / numChans;
                right[bufferStart + i] *= r / numChans;
            }
        } else {
            memory.fill(left.dataStart + bufferStart, 0, numSamples);
            memory.fill(right.dataStart + bufferStart, 0, numSamples);
        }
    }

    static ApplyEvent(ev: AudioEvent): void {
        const dataIndex: i32 = ev.RegisterIndex;
        const maxSize: i32 = AudioData.registers.length;
        assert(dataIndex >= 0 && dataIndex < maxSize, `Unexpected data index: ${dataIndex} - data size: ${maxSize}`)
        AudioData.registers[dataIndex] = ev.Value;
        if (ev.Type < <u8>AudioRegisterType.WaveStart) {
            const t = <AudioRegisterType>ev.Type;
            if (Logger.verbose >= 2) {
                log('Apply Event ' + uToHex<u8>(ev.Type));
            }
            switch (t) {
                case AudioRegisterType.NR10_C1Sweep:
                    // TODO
                    break;
                case AudioRegisterType.NR11_C1Length:
                    AudioRender.channel1.setDutyCycle(<DutyCycle>(ev.Value >> 6));
                    AudioRender.channel1.LengthTimer = ev.Value & 0b00111111;
                    break;
                case AudioRegisterType.NR12_C1Volume:
                    if (AudioRender.channel1.Enabled && (ev.Value & 0b11111000) == 0)
                        AudioRender.channel1.disable();
                    AudioRender.channel1.InitialVolume = ev.Value >> 4;
                    AudioRender.channel1.SweepPace = ev.Value & 0b111;
                    AudioRender.channel1.EnvelopeIncreasing = (ev.Value & 8) != 0;
                    break;
                case AudioRegisterType.NR13_C1PeriodLo:
                    AudioRender.channel1.PeriodLow = ev.Value;
                    break;
                case AudioRegisterType.NR14_C1PeriodHi:
                    if (!AudioRender.channel1.Enabled && (ev.Value & 0x80) != 0)
                        AudioRender.channel1.trigger();
                    AudioRender.channel1.LengthEnabled = (ev.Value & 0x40) != 0;
                    AudioRender.channel1.PeriodHigh = ev.Value & 0b111;
                    break;
                case AudioRegisterType.NR21_C2Length:
                    AudioRender.channel2.setDutyCycle(<DutyCycle>(ev.Value >> 6));
                    AudioRender.channel2.LengthTimer = ev.Value & 0b00111111;
                    break;
                case AudioRegisterType.NR22_C2Volume:
                    if (AudioRender.channel2.Enabled && (ev.Value & 0b11111000) == 0)
                        AudioRender.channel2.disable();
                    AudioRender.channel2.InitialVolume = ev.Value >> 4;
                    AudioRender.channel2.SweepPace = ev.Value & 0b111;
                    AudioRender.channel2.EnvelopeIncreasing = (ev.Value & 8) != 0;
                    break;
                case AudioRegisterType.NR23_C2PeriodLo:
                    AudioRender.channel2.PeriodLow = ev.Value;
                    break;
                case AudioRegisterType.NR24_C2PeriodHi:
                    if (!AudioRender.channel2.Enabled && (ev.Value & 0x80) != 0)
                        AudioRender.channel2.trigger();
                    AudioRender.channel2.LengthEnabled = (ev.Value & 0x40) != 0;
                    AudioRender.channel2.PeriodHigh = ev.Value & 0b111;
                    break;
                case AudioRegisterType.NR30_C3Enable:
                    AudioRender.channel3.setEnabled((ev.Value & 0x80) != 0);
                    break;
                case AudioRegisterType.NR31_C3Length:
                    AudioRender.channel3.LengthTimer = ev.Value; // this one is 8 bit
                    break;
                case AudioRegisterType.NR32_C3Volume:
                    AudioRender.channel3.Level = <OutputLevel>((ev.Value >> 5) & 0b11);
                    break;
                case AudioRegisterType.NR33_C3PeriodLo:
                    AudioRender.channel3.PeriodLow = ev.Value;
                    break;
                case AudioRegisterType.NR34_C3PeriodHi:
                    if (!AudioRender.channel3.Enabled && (ev.Value & 0x80) != 0)
                        AudioRender.channel3.trigger();
                    AudioRender.channel3.LengthEnabled = (ev.Value & 0x40) != 0;
                    AudioRender.channel3.PeriodHigh = ev.Value & 0b111;
                    break;
                case AudioRegisterType.NR41_C4Length:
                    AudioRender.channel4.LengthTimer = ev.Value & 0b00111111;
                    break;
                case AudioRegisterType.NR42_C4Volume:
                    if (AudioRender.channel4.Enabled && (ev.Value & 0b11111000) == 0)
                        AudioRender.channel4.disable();
                    AudioRender.channel4.InitialVolume = ev.Value >> 4;
                    AudioRender.channel4.SweepPace = ev.Value & 0b111;
                    break;
                case AudioRegisterType.NR43_C4Freq:
                    const shift: u8 = (ev.Value >> 4) & 0x0F;
                    AudioRender.channel4.ShortMode = (ev.Value & 0x08) != 0;
                    const divider: u8 = ev.Value & 0b111;
                    AudioRender.channel4.setLsfrClock(shift, divider);
                    break;
                case AudioRegisterType.NR44_C4Control:
                    if (!AudioRender.channel4.Enabled && (ev.Value & 0x80) != 0)
                        AudioRender.channel4.trigger();
                    break;
                case AudioRegisterType.NR50_Volume:
                    const leftVolume = (ev.Value >> 4) & 0x7;
                    const rightVolume = ev.Value & 0b111;
                    AudioRender.LeftVolume = (<f32>leftVolume + 1.0) / 8.0;
                    AudioRender.RightVolume = (<f32>rightVolume + 1.0) / 8.0;
                    break;
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
        if (Logger.verbose >= 2 && AudioEventQueue.Size > 0) { // TODO: tone down
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

export function setMuteChannel(channel: u8, setMute: boolean = false): void {
    switch (channel) {
        case 1:
            AudioRender.debugMute1 = setMute;
            break;
        case 2:
            AudioRender.debugMute2 = setMute;
            break;
        case 3:
            AudioRender.debugMute3 = setMute;
            break;
        case 4:
            AudioRender.debugMute4 = setMute;
            break;
        default:
            break;
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
