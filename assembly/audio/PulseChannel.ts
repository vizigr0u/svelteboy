import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { AudioChannelBase } from "./AudioChannelBase";
import { SAMPLE_RATE } from "./constants";

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

const SAMPLES_PER_SWEEP_TICK: f64 = SAMPLE_RATE / 128.0;

@final
export class PulseChannel extends AudioChannelBase {
    private waveHighRatio: f32 = DutyCycleHighRatio(DutyCycle.Medium);
    private frequencyBits: u16 = 1750; // A440
    private angularFrequency: f64;
    private phase: f64 = 0;

    // CH1 frequency sweep state — always inactive for CH2 (pace/step stay 0)
    private sweepShadowPeriod: u16 = 0;
    private sweepSamplesLeft: f64 = 0;
    private sweepEnabled: boolean = false;
    private sweepPace: u8 = 0;
    private sweepStep: u8 = 0;
    private sweepNegate: boolean = false;
    private sweepNegateUsed: boolean = false;

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
        // Note: NR13/14 writes do NOT update sweepShadowPeriod per spec —
        // the shadow register is only updated by sweep ticks and trigger.
    }

    trigger(): void {
        this.baseTrigger();
        // Sweep trigger: copy period to shadow, reset timer, set enabled flag.
        // For CH2 this is a no-op since sweepPace=0 and sweepStep=0 always,
        // so sweepEnabled will be false and all sweep paths remain inactive.
        this.sweepShadowPeriod = this.frequencyBits;
        this.sweepSamplesLeft = <f64>this.sweepPace * SAMPLES_PER_SWEEP_TICK;
        this.sweepEnabled = this.sweepPace != 0 || this.sweepStep != 0;
        this.sweepNegateUsed = false;
        // If step is non-zero, perform immediate frequency calculation + overflow check.
        if (this.sweepStep != 0) {
            if (this.sweepCalcNewPeriod() > 2047) {
                this.disable();
            }
        }
    }

    // Called from ApplyEvent for NR10 writes (CH1 only).
    HandleSweepEvent(value: u8): void {
        const newNegate: boolean = (value & 0x08) != 0;
        // Obscure: clearing negate after subtraction mode was used disables the channel immediately.
        if (this.sweepNegate && !newNegate && this.sweepNegateUsed) {
            this.disable();
        }
        this.sweepPace = (value >> 4) & 0x7;
        this.sweepNegate = newNegate;
        this.sweepStep = value & 0x7;
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

    // Returns the new period value after one sweep iteration.
    // Marks sweepNegateUsed if subtraction mode is used.
    private sweepCalcNewPeriod(): u16 {
        const delta: u16 = this.sweepShadowPeriod >> this.sweepStep;
        if (this.sweepNegate) {
            this.sweepNegateUsed = true;
            return this.sweepShadowPeriod - delta;
        }
        return this.sweepShadowPeriod + delta;
    }

    // Returns samples until the next sweep tick fires, or 0 if sweep is inactive.
    @inline private getSamplesUntilSweep(): i32 {
        if (!this.sweepEnabled || this.sweepPace == 0 || !this.Enabled) return 0;
        return <i32>Math.ceil(this.sweepSamplesLeft);
    }

    // Advances the sweep timer by `elapsed` samples and fires if it expires.
    private tickSweep(elapsed: i32): void {
        if (!this.sweepEnabled || this.sweepPace == 0 || !this.Enabled) return;
        this.sweepSamplesLeft -= <f64>elapsed;
        if (this.sweepSamplesLeft <= 0) {
            // Reload the sweep timer for the next iteration.
            this.sweepSamplesLeft += <f64>this.sweepPace * SAMPLES_PER_SWEEP_TICK;
            const newPeriod: u16 = this.sweepCalcNewPeriod();
            if (newPeriod > 2047) {
                this.disable();
                return;
            }
            if (this.sweepStep != 0) {
                // Write new frequency back to shadow register and channel period.
                this.sweepShadowPeriod = newPeriod;
                this.frequencyBits = newPeriod;
                this.updateFrequency();
                // Second overflow check using the updated shadow — don't write back.
                if (this.sweepCalcNewPeriod() > 2047) {
                    this.disable();
                }
            }
        }
    }

    Reset(): void {
        this.phase = 0.0;
    }

    Render(start: i32, end: i32): void {
        let i: i32 = start;
        assert(i >= 0 && i < this.Buffer.length, `i = ${i} start = ${start} end = ${end}`);
        while (i < end) {
            if (!this.Enabled) {
                return;
            }
            const numSamplesUntilEnvelopeChange: i32 = this.GetNumSamplesUntilEnvelopeVolumeChange();
            const numSamplesUntilSweep: i32 = this.getSamplesUntilSweep();
            const volume: u8 = this.GetCurrentEnvelopeVolume();

            // Segment end is the earliest of: buffer end, next envelope change, next sweep tick.
            let segEnd: i32 = end;
            if (numSamplesUntilEnvelopeChange > 0 && i + numSamplesUntilEnvelopeChange < segEnd) {
                segEnd = i + numSamplesUntilEnvelopeChange;
            }
            if (numSamplesUntilSweep > 0 && i + numSamplesUntilSweep < segEnd) {
                segEnd = i + numSamplesUntilSweep;
            }

            for (let j: i32 = i; j < segEnd; j++) {
                this.Buffer[j] = this.phase >= this.waveHighRatio ? volume : 0;
                if (Logger.verbose >= 3)
                    log(`pulse Sound[${j}] = ${uToHex<u8>(this.Buffer[j])}`);
                this.phase += this.angularFrequency;
                if (this.phase >= 1.0) {
                    if (Logger.verbose >= 2) {
                        log(`(Pulse at ${j}) SinPhase from ${this.phase} to ${this.phase - 1.0}`)
                    }
                    this.phase -= 1.0;
                }
            }

            const elapsed: i32 = segEnd - i;
            this.TickSamples(elapsed);
            this.tickSweep(elapsed);

            i = segEnd;
        }
    }
}
