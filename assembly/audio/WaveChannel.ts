import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { AudioChannelBase, AudioChannelId } from "./AudioChannelBase";
import { AudioData } from "./AudioData";
import { SAMPLE_RATE } from "./constants";
import { Uint4Array } from "./Uint4Array";

export enum OutputLevel {
    Mute = 0,
    Max = 1,
    Half = 2,
    Quarter = 3
}

@final
export class WaveChannel extends AudioChannelBase {
    Level: OutputLevel = OutputLevel.Quarter;

    private waveData: Uint4Array = new Uint4Array(0);
    private frequencyBits: u16 = 1750; // A440
    private angularFrequency: f64;
    private phase: f64 = 1.0; // first sample always skipped (Pan Docs: trigger starts at index 1)

    static Create(): WaveChannel {
        const c = new WaveChannel(AudioChannelId.Channel3);
        c.waveData = AudioData.channel3Wave;
        return c;
    }

    private dacOn: boolean = false;

    setDacOn(on: boolean): void {
        this.dacOn = on;
        if (!on) this.disable();
    }

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

    // Pan Docs: trigger resets sample index to 1 (skipping sample 0).
    // Trigger is ignored when DAC is off (NR30 bit7=0).
    trigger(): void {
        if (!this.dacOn) return;
        this.phase = 1.0;
        this.baseTrigger();
    }

    // Pan Docs: CH3 length timer is 8-bit (0–255), channel plays for (256–NR31)/256 sec.
    // Override base class which uses 64 (CH1/CH2 formula).
    set LengthEnabled(enabled: boolean) {
        if (enabled) {
            this.samplesUntilStop = <i32>Math.round((256.0 - <f64>this.LengthTimer) * (SAMPLE_RATE / 256.0));
        }
        this.lengthEnabled = enabled;
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
                unchecked(this.Buffer[i] = 0);
            }
        } else {
            const shift: u8 = (<u8>this.Level) - 1;
            for (let i: i32 = start; i < end; i++) {
                if (this.Enabled) {
                    assert(i >= 0 && i < this.Buffer.length, `i = ${i} start = ${start} end = ${end}`);
                    const waveIndex: u8 = <u8>Math.floor(this.phase);
                    const x: u8 = this.waveData[waveIndex];
                    unchecked(this.Buffer[i] = x >> shift);
                    if (Logger.verbose >= 3)
                        log(`Wave Sound[${i}] = ${uToHex<u8>(this.Buffer[i])}`);
                    this.phase += this.angularFrequency;
                    while (this.phase >= 32.0) {
                        if (Logger.verbose >= 2) {
                            log(`C4 (at ${start + i}) SinPhase from ${this.phase} to ${this.phase - 32.0}`)
                        }
                        this.phase -= 32.0;
                    }
                } else {
                    unchecked(this.Buffer[i] = 0);
                }
            }
        }
        this.TickSamples(end - start);
    }
}
