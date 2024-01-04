import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { AudioChannelBase } from "./AudioChannelBase";
import { SAMPLE_RATE } from "./audioRegisters";
import { Uint4Array } from "./Uint4Array";

export enum OutputLevel {
    Mute = 0,
    Max = 1,
    Half = 2,
    Quarter = 3
}

@final
export class WaveChannel extends AudioChannelBase {
    SweepPace: u8 = 0;
    Level: OutputLevel = OutputLevel.Quarter;

    private waveData: Uint4Array = new Uint4Array(0);
    private frequencyBits: u16 = 1750; // A440
    private angularFrequency: f64;
    private phase: f64 = 1.0; // Apparently the very first sample is always skipped

    static Create(buffer: Uint4Array, waveData: Uint4Array): WaveChannel {
        const c = new WaveChannel(buffer);
        c.waveData = waveData;
        return c;
    }

    @inline setEnabled(enabled: boolean): void { this.enabled = enabled; }

    set PeriodLow(value: u8) {
        this.frequencyBits = (this.frequencyBits & 0xFF00) | value;
        if (Logger.verbose >= 2) {
            log(`lowFreq change to ${value}: frequencyBits = ${uToHex<u16>(this.frequencyBits)}}`)
        }
        this.updateFrequency();
    }

    set PeriodHigh(value: u8) {
        this.frequencyBits = (this.frequencyBits & 0x00FF) | (<u16>value << 8);
        if (Logger.verbose >= 2) {
            log(`highFreq change to ${value}: frequencyBits = ${uToHex<u16>(this.frequencyBits)} -> <u16>(value & 3) << 8 = ${uToHex<u16>(<u16>(value & 3) << 8)}`)
        }
        this.updateFrequency();
    }

    trigger(): void {
        this.baseTrigger();
    }

    private updateFrequency(): void {
        const f: f64 = 2097152.0 / (2048.0 - <f64>this.frequencyBits);
        if (Logger.verbose >= 2) {
            log(`freq changed to ${f} (with bits ${uToHex<u16>(this.frequencyBits)})`)
        }
        this.angularFrequency = f / SAMPLE_RATE;
    }

    Reset(): void {
        this.phase = 1.0;
    }

    Render(start: i32, end: i32): void {
        if (this.Level == OutputLevel.Mute) {
            for (let i: i32 = start; i < end; i++) {
                this.Buffer[i] = 0;
            }
        } else {
            const shift: u8 = (<u8>this.Level) - 1;
            for (let i: i32 = start; i < end; i++) {
                if (this.Enabled) {
                    assert(i >= 0 && i < this.Buffer.length, `i = ${i} start = ${start} end = ${end}`);
                    const waveIndex: u8 = <u8>Math.floor(this.phase);
                    const x: u8 = this.waveData[waveIndex]; // TODO
                    this.Buffer[i] = x >> shift;
                    if (Logger.verbose >= 3)
                        log(`Wave Sound[${i}] = ${uToHex<u8>(this.Buffer[i])}`);
                    this.phase += this.angularFrequency;
                    if (this.phase >= 32.0) {
                        if (Logger.verbose >= 2) {
                            log(`C4 (at ${start + i}) SinPhase from ${this.phase} to ${this.phase - 1.0}`)
                        }
                        this.phase -= 32.0;
                    }
                }
            }
        }
        this.updateTimer(end - start);
    }
}
