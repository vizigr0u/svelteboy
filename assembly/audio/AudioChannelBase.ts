import { Uint4Array } from "./Uint4Array";

export class AudioChannelBase {
    InitialVolume: u8 = 0xF;
    LengthTimer: f32 = 0;
    Buffer: Uint4Array;

    protected enabled: boolean = false;
    private samplesUntilStop: i32 = 0;
    private lengthEnabled: boolean = false;

    constructor(buffer: Uint4Array) {
        this.Buffer = buffer;
    }

    @inline get Enabled(): boolean { return this.enabled; }

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
}
