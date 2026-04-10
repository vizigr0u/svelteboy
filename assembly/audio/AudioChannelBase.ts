import { Uint4Array } from "./Uint4Array";
import { CYCLES_PER_SECOND } from "../constants";
import { SAMPLE_RATE } from "./constants";

const SAMPLES_PER_ENVELOPE_TICK: f64 = <f64>(SAMPLE_RATE * 64) / <f64>CYCLES_PER_SECOND;

export class AudioChannelBase {
    LengthTimer: f32 = 0;
    Buffer: Uint4Array;

    InitialVolume: u8 = 0xF;
    SweepPace: u8 = 0;
    EnvelopeDirection: i8 = -1;
    SamplePerEnvelopeStep: f64 = 0;
    EnveloppeSamplesRendered: f64 = 0;

    protected enabled: boolean = false;
    private samplesUntilStop: i32 = 0;
    private lengthEnabled: boolean = false;

    constructor(buffer: Uint4Array) {
        this.Buffer = buffer;
    }

    @inline get Enabled(): boolean { return this.enabled; }

    @inline get EnvelopeEnabled(): boolean { return this.SweepPace != 0; }

    set LengthEnabled(enabled: boolean) {
        if (enabled) {
            this.samplesUntilStop = <i32>Math.round(this.LengthTimer * 72.26562);
        }
        this.lengthEnabled = enabled;
    }

    disable(): void {
        this.enabled = false;
    }

    protected baseTrigger(): void {
        this.enabled = true;
    }

    protected updateTimer(samplesEllapsed: i32): void {
        if (this.samplesUntilStop > 0 && this.lengthEnabled) {
            if (samplesEllapsed >= this.samplesUntilStop) {
                this.samplesUntilStop = 0;
                this.lengthEnabled = false;
                this.enabled = false;
            } else {
                this.samplesUntilStop -= samplesEllapsed;
            }
        }
    }

    HandleEnvelopeEvent(volume: u8): void {
        this.InitialVolume = volume >> 4;
        this.SweepPace = volume & 0b111;
        this.EnvelopeDirection = (volume & 8) != 0 ? 1 : -1;
        if (this.Enabled && this.InitialVolume == 0 && this.EnvelopeDirection == -1) {
            this.disable();
        }

        if (this.EnvelopeEnabled) {
            this.SamplePerEnvelopeStep = SAMPLES_PER_ENVELOPE_TICK * <f64>this.SweepPace;
            this.EnveloppeSamplesRendered = 0;
            assert(this.SamplePerEnvelopeStep > <f64>0.001, `SamplePerEnvelopeStep should be > 0, got ${this.SamplePerEnvelopeStep}: SweepPace = ${this.SweepPace} InitialVolume = ${this.InitialVolume} EnvelopeDirection = ${this.EnvelopeDirection} SAMPLES_PER_ENVELOPE_TICK = ${SAMPLES_PER_ENVELOPE_TICK}`);
        }
    }

    GetNumSamplesUntilEnvelopeVolumeChange(): i32 {
        if (!this.EnvelopeEnabled) {
            return 0;
        }
        assert(this.SamplePerEnvelopeStep > <f64>0.001, `SamplePerEnvelopeStep should be > 0, got ${this.SamplePerEnvelopeStep}`);
        const maxSteps: u8 = this.EnvelopeDirection > 0 ? 0xF - this.InitialVolume : this.InitialVolume;
        const steps: u8 = <u8>Math.min(this.EnveloppeSamplesRendered / this.SamplePerEnvelopeStep, <f64>maxSteps);
        const nextStepSample: f64 = <f64>(steps + 1) * this.SamplePerEnvelopeStep;
        const samplesUntil: i32 = <i32>Math.ceil(nextStepSample - this.EnveloppeSamplesRendered);
        return samplesUntil;
    }

    GetCurrentEnvelopeVolume(): u8 {
        if (!this.EnvelopeEnabled) {
            return this.InitialVolume;
        }
        assert(this.SamplePerEnvelopeStep > <f64>0.001, `SamplePerEnvelopeStep should be > 0, got ${this.SamplePerEnvelopeStep}`);
        const maxSteps: u8 = this.EnvelopeDirection > 0 ? 0xF - this.InitialVolume : this.InitialVolume;
        const steps: u8 = <u8>Math.min(this.EnveloppeSamplesRendered / this.SamplePerEnvelopeStep, <f64>maxSteps);
        return <u8>(this.InitialVolume + steps * this.EnvelopeDirection);
    }
}
