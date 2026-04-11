import { Uint4Array } from "./Uint4Array";
import { SAMPLE_RATE } from "./constants";

const SAMPLES_PER_ENVELOPE_TICK: f64 = SAMPLE_RATE / 64.0;

export class AudioChannelBase {
    LengthTimer: f32 = 0;
    Buffer: Uint4Array;

    private InitialVolume: u8 = 0xF;
    private SweepPace: u8 = 0;
    private EnvelopeDirection: i8 = -1;
    private SamplePerEnvelopeStep: f64 = 0;
    private EnvelopeLeft: f64 = 0;

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
            this.samplesUntilStop = <i32>Math.round((64.0 - <f64>this.LengthTimer) * (SAMPLE_RATE / 256.0));
        }
        this.lengthEnabled = enabled;
    }

    disable(): void {
        this.enabled = false;
    }

    protected baseTrigger(): void {
        this.enabled = true;
        if (this.EnvelopeEnabled) {
            this.EnvelopeLeft = 1.0;
        }
    }

    protected TickSamples(samplesEllapsed: i32): void {
        if (this.samplesUntilStop > 0 && this.lengthEnabled) {
            if (samplesEllapsed >= this.samplesUntilStop) {
                this.samplesUntilStop = 0;
                this.lengthEnabled = false;
                this.enabled = false;
            } else {
                this.samplesUntilStop -= samplesEllapsed;
            }
        }
        if (this.EnvelopeEnabled && this.enabled) {
            const totalSteps: u8 = this.EnvelopeDirection > 0 ? 0xF - this.InitialVolume : this.InitialVolume;
            const totalSamples: f64 = Math.round(<f64>totalSteps * this.SamplePerEnvelopeStep);
            this.EnvelopeLeft = this.EnvelopeLeft - (<f64>samplesEllapsed / totalSamples);
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
            this.SamplePerEnvelopeStep = <f64>SAMPLES_PER_ENVELOPE_TICK * <f64>this.SweepPace;
            assert(this.SamplePerEnvelopeStep > <f64>0.001, `SamplePerEnvelopeStep should be > 0, got ${this.SamplePerEnvelopeStep}: SweepPace = ${this.SweepPace} InitialVolume = ${this.InitialVolume} EnvelopeDirection = ${this.EnvelopeDirection} SAMPLES_PER_ENVELOPE_TICK = ${SAMPLES_PER_ENVELOPE_TICK}`);
        }
    }

    GetNumSamplesUntilEnvelopeVolumeChange(): i32 {
        if (!this.EnvelopeEnabled || !this.enabled || this.EnvelopeLeft <= 0) {
            return 0;
        }
        const totalSteps: u8 = this.EnvelopeDirection > 0 ? 0xF - this.InitialVolume : this.InitialVolume;
        const totalSamples: f64 = Math.round(<f64>totalSteps * this.SamplePerEnvelopeStep);
        return <i32>Math.ceil(this.EnvelopeLeft * totalSamples);
    }

    GetCurrentEnvelopeVolume(): u8 {
        if (!this.EnvelopeEnabled || !this.enabled) {
            return this.InitialVolume;
        }
        const envelopeLeft = this.EnvelopeLeft;
        if (envelopeLeft <= 0) {
            return this.EnvelopeDirection > 0 ? 0xF : 0;
        }
        const totalSteps: u8 = this.EnvelopeDirection > 0 ? 0xF - this.InitialVolume : this.InitialVolume;
        const volumeChange: i8 = <i8>Math.floor((1.0 - envelopeLeft) * <f64>totalSteps);
        return <u8>(this.InitialVolume + volumeChange * this.EnvelopeDirection);
    }
}
