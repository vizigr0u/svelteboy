import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";
import { log } from "./apu";
import { AudioChannelBase, AUDIO_CHANNEL_BASE_SIZE } from "./AudioChannelBase";
import { SAMPLE_RATE } from "./constants";

export const NOISE_CHANNEL_EXTRA_SIZE: u32 = 23;
export const NOISE_CHANNEL_SERIALIZED_SIZE: u32 = AUDIO_CHANNEL_BASE_SIZE + NOISE_CHANNEL_EXTRA_SIZE;

@final
export class NoiseChannel extends AudioChannelBase {
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
        // Spec: shift 14 or 15 → LFSR receives no clocks (hardware clock generator broken at these values)
        if (shift >= 14) {
            this.lsfrPeriod = 1e38;
            return;
        }
        this.lsfrPeriod = (divider == 0)
            ? <f64>1 / <f64>(524288 >> shift)
            : <f64>divider / <f64>(262144 >> shift);
        if (Logger.verbose >= 3) {
            log(`Set LSFR clock: shift ${shift}, divider ${divider} -> period ${this.lsfrPeriod}`);
        }
    }

    serialize(ptr: usize): usize {
        ptr = super.serialize(ptr);
        store<u8>(ptr, this.ShortMode ? 1 : 0); ptr += 1;
        store<u16>(ptr, this.Lsfr); ptr += 2;
        store<f64>(ptr, this.lsfrPeriod); ptr += 8;
        store<f64>(ptr, this.lsfrTimeOffset); ptr += 8;
        store<u32>(ptr, this.lsfrSampleCount); ptr += 4;
        return ptr;
    }

    deserialize(ptr: usize): usize {
        ptr = super.deserialize(ptr);
        this.ShortMode = load<u8>(ptr) != 0; ptr += 1;
        this.Lsfr = load<u16>(ptr); ptr += 2;
        this.lsfrPeriod = load<f64>(ptr); ptr += 8;
        this.lsfrTimeOffset = load<f64>(ptr); ptr += 8;
        this.lsfrSampleCount = load<u32>(ptr); ptr += 4;
        return ptr;
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
        let i: i32 = start;
        assert(i >= 0 && i < this.Buffer.length, `i = ${i} start = ${start} end = ${end}`);
        while (i < end) {
            if (!this.Enabled) {
                for (let j = i; j < end; j++) unchecked(this.Buffer[j] = 0);
                return;
            }
            const numSamplesUntilEnvelopeChange: i32 = this.GetNumSamplesUntilEnvelopeVolumeChange();
            const volume: u8 = this.GetCurrentEnvelopeVolume();
            const segEnd: i32 = numSamplesUntilEnvelopeChange > 0 && numSamplesUntilEnvelopeChange < (end - i) ? i + numSamplesUntilEnvelopeChange : end;

            for (let j: i32 = i; j < segEnd; j++) {
                unchecked(this.Buffer[j] = (this.Lsfr & 1) != 0 ? volume : 0);
                if (Logger.verbose >= 4)
                    log(`c4Sound[${j}] = ${uToHex<u8>(this.Buffer[j])}`);
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
            this.TickSamples(segEnd - i);

            i = segEnd;
        }
        // this.updateTimer(end - start); // TODO: handle timer better?
    }
}
