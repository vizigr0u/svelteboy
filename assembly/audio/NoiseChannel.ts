import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { SAMPLE_RATE } from "./audioRegisters";

@final
export class NoiseChannel {
    MixLeft: boolean = true;
    MixRight: boolean = true;
    Volume: u8 = 0xF;
    SweepPace: u8 = 0;
    ShortMode: boolean = false;
    LengthTimer: f32 = 0;
    Buffer: Uint8Array;
    Lsfr: u16 = 0;

    private lsfrPeriod: f64 = <f64>1 / <f64>262144;
    private lsfrTimeOffset: f64 = 0;
    private lsfrSampleCount: u32 = 0;
    private enabled: boolean = false;
    private samplesUntilStop: i32 = 0;
    private timerEnabled: boolean = false;

    constructor(buffer: Uint8Array) {
        this.Buffer = buffer;
    }

    set TimerEnabled(enabled: boolean) {
        if (enabled) {
            this.samplesUntilStop = <i32>Math.round(this.LengthTimer * 72.26562);
        }
        this.timerEnabled = enabled;
    }

    @inline get Enabled(): boolean { return this.enabled; }

    set Enabled(enabled: boolean) {
        if (enabled) {
            this.trigger();
        }
        this.enabled = enabled;
    }

    Reset(): void {
        this.Lsfr = 0;
        this.lsfrTimeOffset = 0;
        this.lsfrSampleCount = 0;
    }

    trigger(): void {
        this.Lsfr = 0;
        this.lsfrTimeOffset = 0;
        this.lsfrSampleCount = 0;
    }

    setLsfrClock(shift: u8, divider: u8): void {
        this.lsfrPeriod = (divider == 0)
            ? <f64>1 / <f64>(524288 >> shift)
            : <f64>divider / <f64>(262144 >> shift);
    }

    TickLsfr(): u16 {
        const lowsAreEqual: u16 = ~((this.Lsfr ^ (this.Lsfr >> 1)) & 1);
        this.Lsfr = (this.Lsfr & ~0x80) | lowsAreEqual << 15; // set bit 15
        if (this.ShortMode) {
            this.Lsfr = (this.Lsfr & ~0x08) | lowsAreEqual << 7; // set bit 7
        }
        return this.Lsfr >> 1;
    }

    Render(start: i32, end: i32): void {
        for (let i: i32 = start; i < end; i++) {
            if (this.Enabled) {
                assert(i >= 0 && i < this.Buffer.length, `i = ${i} start = ${start} end = ${end}`);
                this.Buffer[i] = (this.Lsfr & 1) != 0 ? this.Volume : 0;
                if (Logger.verbose >= 2)
                    log(`c4Sound[${i}] = ${uToHex<u8>(this.Buffer[i])}`);
                this.lsfrSampleCount++;
                const timeEllapsed: f64 = this.lsfrTimeOffset + <f64>this.lsfrSampleCount / SAMPLE_RATE;
                const dt: f64 = timeEllapsed - this.lsfrPeriod;
                if (dt >= 0) {
                    this.TickLsfr();
                    this.lsfrSampleCount = 0;
                    this.lsfrTimeOffset = dt;
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
