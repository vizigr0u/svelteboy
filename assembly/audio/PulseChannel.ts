import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { AudioChannelBase } from "./AudioChannelBase";
import { SAMPLE_RATE } from "./audioRegisters";

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
export class PulseChannel extends AudioChannelBase {
    SweepPace: u8 = 0;
    EnvelopeIncreasing: boolean = false;

    private waveHighRatio: f32 = DutyCycleHighRatio(DutyCycle.Medium);
    private frequencyBits: u16 = 1750; // A440
    private angularFrequency: f64;
    private phase: f64 = 0;

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
                const x: u8 = this.phase >= this.waveHighRatio ? this.InitialVolume : 0;
                this.Buffer[i] = x;
                if (Logger.verbose >= 3)
                    log(`pulse Sound[${i}] = ${uToHex<u8>(this.Buffer[i])}`);
                this.phase += this.angularFrequency;
                if (this.phase >= 1.0) {
                    if (Logger.verbose >= 2) {
                        log(`(Pulse at ${start + i}) SinPhase from ${this.phase} to ${this.phase - 1.0}`)
                    }
                    this.phase -= 1.0;
                }
            }
        }
        this.updateTimer(end - start);
    }
}
