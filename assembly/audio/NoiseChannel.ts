import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { AudioChannelBase } from "./AudioChannelBase";
import { SAMPLE_RATE } from "./audioRegisters";

@final
export class NoiseChannel extends AudioChannelBase {
    SweepPace: u8 = 0;
    ShortMode: boolean = false;
    Lsfr: u16 = 0;

    private lsfrPeriod: f64 = <f64>1 / <f64>262144;
    private lsfrTimeOffset: f64 = 0;
    private lsfrSampleCount: u32 = 0;

    Reset(): void {
        this.Lsfr = 0;
        this.lsfrTimeOffset = 0;
        this.lsfrSampleCount = 0;
    }

    trigger(): void {
        this.baseTrigger();
        this.Reset();
    }

    setLsfrClock(shift: u8, divider: u8): void {
        this.lsfrPeriod = (divider == 0)
            ? <f64>1 / <f64>(524288 >> shift)
            : <f64>divider / <f64>(262144 >> shift);
        if (Logger.verbose >= 3) {
            log(`Set LSFR clock: shift ${shift}, divider ${divider} -> period ${this.lsfrPeriod}`);
        }
    }

    TickLsfr(): void {
        const lowsAreEqual: u16 = ~(this.Lsfr ^ (this.Lsfr >> 1)) & 1;
        this.Lsfr = (this.Lsfr & ~0x8000) | lowsAreEqual << 15; // set bit 15
        if (this.ShortMode) {
            this.Lsfr = (this.Lsfr & ~0x80) | lowsAreEqual << 7; // set bit 7
        }
        this.Lsfr = this.Lsfr >> 1;
    }

    Render(start: i32, end: i32): void {
        for (let i: i32 = start; i < end; i++) {
            if (this.Enabled) {
                assert(i >= 0 && i < this.Buffer.length, `i = ${i} start = ${start} end = ${end}`);
                this.Buffer[i] = (this.Lsfr & 1) != 0 ? this.InitialVolume : 0;
                if (Logger.verbose >= 4)
                    log(`c4Sound[${i}] = ${uToHex<u8>(this.Buffer[i])}`);
                this.lsfrSampleCount++;
                const timeElapsed: f64 = this.lsfrTimeOffset + <f64>this.lsfrSampleCount / SAMPLE_RATE;
                const dt: f64 = timeElapsed - this.lsfrPeriod;
                if (dt >= 0) {
                    this.TickLsfr();
                    if (Logger.verbose >= 3) {
                        log(`Chan4 LSFR tick after ${timeElapsed} (${this.lsfrSampleCount} samples) -> 0b${this.Lsfr.toString(2)}`);
                    }
                    this.lsfrSampleCount = 0;
                    this.lsfrTimeOffset = dt;
                }
            }
        }
        this.updateTimer(end - start);
    }
}
