import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { SAMPLE_RATE } from "./audioRegisters";

import { Uint4Array } from "./Uint4Array";

export enum DutyCycle {
    VeryHigh = 0,
    High = 1,
    Medium = 2,
    Low = 3
}

function DutyCycleHighRatio(dc: DutyCycle): f32 {
    switch (dc) {
        case DutyCycle.VeryHigh:
            return 0.875;
        case DutyCycle.High:
            return 0.75;
        case DutyCycle.Medium:
            return 0.5;
        case DutyCycle.Low:
            return 0.25;
        default:
            assert(false, 'Unexpected DutyCycle: ' + uToHex<u8>(<u8>dc));
            unreachable();
            return 0.5;
    }
}

@final
export class PulseChannel {
    MixLeft: boolean = true;
    MixRight: boolean = true;
    Volume: u8 = 0xF;
    SweepPace: u8 = 0;
    LengthTimer: f32 = 0;
    Buffer: Uint4Array;

    private enabled: boolean = false;
    private waveHighRatio: f32 = DutyCycleHighRatio(DutyCycle.Medium);
    private frequencyBits: u16 = 1750; // A440
    private angularFrequency: f64;
    private phase: f64 = 0;
    private samplesUntilStop: i32 = 0;
    private timerEnabled: boolean = false;

    constructor(buffer: Uint4Array) {
        this.Buffer = buffer;
    }

    @inline get Enabled(): boolean { return this.enabled; }

    set Enabled(enabled: boolean) {
        if (enabled) {
            this.trigger();
        }
        this.enabled = enabled;
    }

    @inline
    get AngularFrequency(): f64 { return this.angularFrequency; }

    set PeriodLow(value: u8) {
        this.frequencyBits = (this.frequencyBits & 0xFF00) | value;
        if (Logger.verbose >= 2) {
            log(`lowFreq change to ${value}: frequencyBits = ${uToHex<u16>(this.frequencyBits)}}`)
        }
        this.updateFrequency();
    }

    set TimerEnabled(enabled: boolean) {
        if (enabled) {
            this.samplesUntilStop = <i32>Math.round(this.LengthTimer * 72.26562);
        }
        this.timerEnabled = enabled;
    }

    set PeriodHigh(value: u8) {
        this.frequencyBits = (this.frequencyBits & 0x00FF) | (<u16>value << 8);
        if (Logger.verbose >= 2) {
            log(`highFreq change to ${value}: frequencyBits = ${uToHex<u16>(this.frequencyBits)} -> <u16>(value & 3) << 8 = ${uToHex<u16>(<u16>(value & 3) << 8)}`)
        }
        this.updateFrequency();
    }

    trigger(): void {

    }

    setDutyCycle(waveDutyCycle: DutyCycle): void {
        this.waveHighRatio = DutyCycleHighRatio(waveDutyCycle);
        if (Logger.verbose >= 2) {
            log(`DutyCycle change to ${waveDutyCycle}`)
        }
    }

    private updateFrequency(): void {
        const f: f64 = 131072.0 / (2048.0 - <f64>this.frequencyBits);
        if (Logger.verbose >= 2) {
            log(`freq changed to ${f} (with bits ${uToHex<u16>(this.frequencyBits)})`)
        }
        this.angularFrequency = f / SAMPLE_RATE;
    }

    Reset(): void {
        this.phase = 0.0;
    }

    Render(start: i32, end: i32): void {
        for (let i: i32 = start; i < end; i++) {
            if (this.Enabled) {
                assert(i >= 0 && i < this.Buffer.length, `i = ${i} start = ${start} end = ${end}`);
                const x: u8 = this.phase >= this.waveHighRatio ? this.Volume : 0;
                this.Buffer[i] = x;
                if (Logger.verbose >= 3)
                    log(`pulse Sound[${i}] = ${uToHex<u8>(this.Buffer[i])}`);
                this.phase += this.AngularFrequency;
                if (this.phase >= 1.0) {
                    if (Logger.verbose >= 2) {
                        log(`(at ${start + i}) SinPhase from ${this.phase} to ${this.phase - 1.0}`)
                    }
                    this.phase -= 1.0;
                }
            }
        }
        if (this.samplesUntilStop > 0 && this.timerEnabled) {
            const samplesEllapsed: i32 = end - start;
            if (samplesEllapsed >= this.samplesUntilStop) {
                this.samplesUntilStop = 0;
                this.timerEnabled = false;
                this.Enabled = false;
            } else {
                this.samplesUntilStop -= samplesEllapsed;
            }
        }
    }
}
