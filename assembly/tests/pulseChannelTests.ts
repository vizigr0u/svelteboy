import { MemoryMap } from "../memory/memoryMap";
import { AudioRender } from "../audio/render";
import { AudioEventQueue } from "../audio/eventQueue";
import { PulseChannel } from "../audio/PulseChannel";
import { describe, it, assertEquals } from "./framework";
import { setTestRom } from "./cpuTests";

// Channel buffer capacity per Render call: AudioOutBuffer.BufferSize >> 1 = 128
const BUF: i32 = 128;
// Samples for one sweep tick at pace=1: ceil(44100 / 128) = 345
const SWEEP_TICK: i32 = 345;
// Samples for one envelope pace unit: ceil(44100 / 64) = 690
const ENV_TICK: i32 = 690;
// Passes required to trigger one sweep tick (3 × 128 = 384 > 345)
const SWEEP_PASSES: i32 = 3;
// Passes required to advance one envelope step at pace=1 (6 × 128 = 768 > 690)
const ENV_PASSES: i32 = 6;

function flushAudioEvents(): void {
    while (!AudioEventQueue.IsEmpty()) {
        AudioRender.ApplyEvent(AudioEventQueue.Dequeue());
    }
}

function initAudio(): void {
    setTestRom([0x00]);
    AudioRender.Prepare(0);
    MemoryMap.GBstore<u8>(0xFF26, 0x80); // NR52: APU on
    flushAudioEvents();
}

// Write CH1 registers and trigger.
// dutyLen = NR11: bits[7:6]=duty pattern, bits[5:0]=length timer
// vol = NR12: bits[7:4]=initial volume, bit[3]=increase(1)/decrease(0), bits[2:0]=pace
// period = 11-bit period value
// sweep = NR10: bits[6:4]=pace, bit[3]=negate, bits[2:0]=step
function triggerCH1(sweep: u8, dutyLen: u8, vol: u8, period: u16, lenEn: bool): void {
    MemoryMap.GBstore<u8>(0xFF10, sweep);
    MemoryMap.GBstore<u8>(0xFF11, dutyLen);
    MemoryMap.GBstore<u8>(0xFF12, vol);
    MemoryMap.GBstore<u8>(0xFF13, <u8>(period & 0xFF));
    MemoryMap.GBstore<u8>(0xFF14, 0x80 | (lenEn ? 0x40 : 0) | <u8>((period >> 8) & 0x7));
    flushAudioEvents();
}

function triggerCH2(dutyLen: u8, vol: u8, period: u16, lenEn: bool): void {
    MemoryMap.GBstore<u8>(0xFF16, dutyLen);
    MemoryMap.GBstore<u8>(0xFF17, vol);
    MemoryMap.GBstore<u8>(0xFF18, <u8>(period & 0xFF));
    MemoryMap.GBstore<u8>(0xFF19, 0x80 | (lenEn ? 0x40 : 0) | <u8>((period >> 8) & 0x7));
    flushAudioEvents();
}

function countHigh(ch: PulseChannel): i32 {
    let n = 0;
    for (let i = 0; i < BUF; i++) {
        if (ch.Buffer[i] > 0) n++;
    }
    return n;
}

// Count low→high transitions in current buffer, given the last sample from previous pass.
function countRising(ch: PulseChannel, prevLast: u8): i32 {
    let n = 0;
    if (ch.Buffer[0] > 0 && prevLast == 0) n++;
    for (let i = 1; i < BUF; i++) {
        if (ch.Buffer[i] > 0 && ch.Buffer[i - 1] == 0) n++;
    }
    return n;
}

// Render passes BUF-sized chunks, accumulating high-sample count.
function renderAndCountHigh(ch: PulseChannel, passes: i32): i32 {
    let n = 0;
    for (let p = 0; p < passes; p++) {
        ch.Render(0, BUF);
        n += countHigh(ch);
    }
    return n;
}

// Render passes BUF-sized chunks, accumulating rising-edge count.
function renderAndCountRising(ch: PulseChannel, passes: i32): i32 {
    let n = 0;
    let prev: u8 = ch.Buffer[BUF - 1];
    for (let p = 0; p < passes; p++) {
        ch.Render(0, BUF);
        n += countRising(ch, prev);
        prev = ch.Buffer[BUF - 1];
    }
    return n;
}

// Advance state without accumulating counts.
function advancePasses(ch: PulseChannel, passes: i32): void {
    for (let p = 0; p < passes; p++) {
        ch.Render(0, BUF);
    }
}

// ─── Duty Cycle ──────────────────────────────────────────────────────────────

function testDutyCycles(): void {
    // Pan Docs: CH1/CH2 duty patterns: 00=12.5%, 01=25%, 10=50%, 11=75%
    // Encoded in NR11/NR21 bits [7:6].
    // Waveform impl: output=volume when phase >= waveHighRatio, else 0.
    //   waveHighRatio: 00→0.875(12.5% high), 01→0.75(25%), 10→0.5(50%), 11→0.25(75%)
    // period=2040: f=131072/8=16384Hz → ~47.6 cycles per 128 samples → reliable ratio counting.
    // vol=0xF0: initial vol=15, pace=0 (frozen, no envelope).
    // 3 passes = 384 samples, ~142 cycles.
    // Expected high samples: 12.5%→~48, 25%→~96, 50%→~192, 75%→~288. Tolerance ±20%.
    const PERIOD: u16 = 2040;
    const VOL: u8 = 0xF0;
    const PASSES: i32 = 3;

    describe("duty cycle waveform", () => {
        it("CH1 NR11=0x00 (duty 00): ~12.5% high samples (range 30-66 / 384)", () => {
            initAudio();
            triggerCH1(0, 0x00, VOL, PERIOD, false);
            const high = renderAndCountHigh(AudioRender.channel1, PASSES);
            assert(high >= 30 && high <= 66,
                `duty 00 (12.5%): expected 30-66 high samples, got ${high}`);
        });

        it("CH1 NR11=0x40 (duty 01): ~25% high samples (range 78-114 / 384)", () => {
            initAudio();
            triggerCH1(0, 0x40, VOL, PERIOD, false);
            const high = renderAndCountHigh(AudioRender.channel1, PASSES);
            assert(high >= 78 && high <= 114,
                `duty 01 (25%): expected 78-114 high samples, got ${high}`);
        });

        it("CH1 NR11=0x80 (duty 10): ~50% high samples (range 163-221 / 384)", () => {
            initAudio();
            triggerCH1(0, 0x80, VOL, PERIOD, false);
            const high = renderAndCountHigh(AudioRender.channel1, PASSES);
            assert(high >= 163 && high <= 221,
                `duty 10 (50%): expected 163-221 high samples, got ${high}`);
        });

        it("CH1 NR11=0xC0 (duty 11): ~75% high samples (range 245-323 / 384)", () => {
            initAudio();
            triggerCH1(0, 0xC0, VOL, PERIOD, false);
            const high = renderAndCountHigh(AudioRender.channel1, PASSES);
            assert(high >= 245 && high <= 323,
                `duty 11 (75%): expected 245-323 high samples, got ${high}`);
        });

        it("CH2 NR21=0x80 (duty 10): ~50% high samples — sweep absent on CH2", () => {
            initAudio();
            triggerCH2(0x80, VOL, PERIOD, false);
            const high = renderAndCountHigh(AudioRender.channel2, PASSES);
            assert(high >= 163 && high <= 221,
                `CH2 duty 10 (50%): expected 163-221, got ${high}`);
        });

        it("high-sample counts are strictly ordered: duty00 < duty01 < duty10 < duty11", () => {
            initAudio(); triggerCH1(0, 0x00, VOL, PERIOD, false);
            const h0 = renderAndCountHigh(AudioRender.channel1, PASSES);
            initAudio(); triggerCH1(0, 0x40, VOL, PERIOD, false);
            const h1 = renderAndCountHigh(AudioRender.channel1, PASSES);
            initAudio(); triggerCH1(0, 0x80, VOL, PERIOD, false);
            const h2 = renderAndCountHigh(AudioRender.channel1, PASSES);
            initAudio(); triggerCH1(0, 0xC0, VOL, PERIOD, false);
            const h3 = renderAndCountHigh(AudioRender.channel1, PASSES);
            assert(h0 < h1 && h1 < h2 && h2 < h3,
                `duty ordering violated: ${h0} < ${h1} < ${h2} < ${h3}`);
        });
    });
}

// ─── Frequency / Period Encoding ─────────────────────────────────────────────

function testFrequencyPeriodEncoding(): void {
    // Pan Docs: f = 131072 / (2048 − period). period=0 → 64 Hz (lowest); period=0x7FF → 131072 Hz (highest).
    // Verified by counting rising edges (one per cycle) in a fixed sample window.
    // period=0:      f=64 Hz,    ~0.56 cycles / 384 samples  → 0-2 rising edges
    // period=0x700:  f=512 Hz,   ~4.46 cycles / 384 samples  → ~4-5 edges
    // period=0x780:  f=1024 Hz,  ~8.92 cycles / 384 samples  → ~9 edges
    const VOL: u8 = 0xF0;
    const DUTY: u8 = 0x80; // 50% duty for reliable edge detection
    const PASSES: i32 = 3;

    describe("frequency period encoding", () => {
        it("period=0 (f=64Hz): at most 2 rising edges in 384 samples", () => {
            initAudio();
            triggerCH1(0, DUTY, VOL, 0, false);
            const edges = renderAndCountRising(AudioRender.channel1, PASSES);
            assert(edges <= 2, `period=0 (64Hz) should give ≤2 rising edges in 384 samples, got ${edges}`);
        });

        it("period=0x780 (f=1024Hz): 7-11 rising edges in 384 samples", () => {
            initAudio();
            triggerCH1(0, DUTY, VOL, 0x780, false);
            const edges = renderAndCountRising(AudioRender.channel1, PASSES);
            assert(edges >= 7 && edges <= 11,
                `period=0x780 (1024Hz) should give 7-11 rising edges in 384 samples, got ${edges}`);
        });

        it("higher period → more rising edges (higher frequency)", () => {
            initAudio();
            triggerCH1(0, DUTY, VOL, 0, false);
            const edgesLow = renderAndCountRising(AudioRender.channel1, PASSES);

            initAudio();
            triggerCH1(0, DUTY, VOL, 0x780, false);
            const edgesHigh = renderAndCountRising(AudioRender.channel1, PASSES);

            assert(edgesHigh > edgesLow * 3,
                `period 0x780 should give far more edges than period 0 (${edgesHigh} vs ${edgesLow})`);
        });

        it("period=0x700 (f=512Hz) gives fewer cycles than period=0x780 (f=1024Hz)", () => {
            initAudio();
            triggerCH1(0, DUTY, VOL, 0x700, false);
            const e1 = renderAndCountRising(AudioRender.channel1, PASSES);

            initAudio();
            triggerCH1(0, DUTY, VOL, 0x780, false);
            const e2 = renderAndCountRising(AudioRender.channel1, PASSES);

            assert(e2 > e1,
                `period=0x780 should give more edges than period=0x700 (${e2} vs ${e1})`);
        });
    });
}

// ─── Envelope: Initial Volume ─────────────────────────────────────────────────

function testEnvelopeInitialVolume(): void {
    // NR12 bits[7:4] = initial volume (0-15). With pace=0 (EnvelopeEnabled=false),
    // GetCurrentEnvelopeVolume() returns InitialVolume directly. All non-zero buffer
    // samples must equal the initial volume.
    const PERIOD: u16 = 2040;

    describe("envelope initial volume", () => {
        it("CH1 NR12=0xF0 (vol=15, pace=0): all non-zero samples equal 15", () => {
            initAudio();
            triggerCH1(0, 0x80, 0xF0, PERIOD, false);
            AudioRender.channel1.Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                const v = AudioRender.channel1.Buffer[i];
                assert(v == 0 || v == 15, `sample ${i}: expected 0 or 15, got ${v}`);
            }
        });

        it("CH1 NR12=0x80 (vol=8, pace=0): all non-zero samples equal 8", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x80, PERIOD, false);
            AudioRender.channel1.Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                const v = AudioRender.channel1.Buffer[i];
                assert(v == 0 || v == 8, `sample ${i}: expected 0 or 8, got ${v}`);
            }
        });

        it("CH2 NR22=0x50 (vol=5, pace=0): all non-zero samples equal 5", () => {
            initAudio();
            triggerCH2(0x80, 0x50, PERIOD, false);
            AudioRender.channel2.Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                const v = AudioRender.channel2.Buffer[i];
                assert(v == 0 || v == 5, `CH2 sample ${i}: expected 0 or 5, got ${v}`);
            }
        });

        it("GetCurrentEnvelopeVolume() immediately after trigger returns initial volume", () => {
            initAudio();
            // vol=12, pace=1 (envelope active), decrease direction
            triggerCH1(0, 0x80, 0xC1, PERIOD, false);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 12,
                "GetCurrentEnvelopeVolume right after trigger");
        });
    });
}

// ─── Envelope: Decrease ───────────────────────────────────────────────────────

function testEnvelopeDecrease(): void {
    // NR12 bit3=0 (decrease), bits[2:0]=pace.
    // With vol=8, pace=1, decrease: totalSamples = round(8 × 689.06) = 5513.
    // After N samples: volumeChange = floor(N / 5513 × 8).
    // 6 passes = 768 > 690 samples → floor(768/5513×8) = 1 → vol = 8−1 = 7.
    // 5 passes = 640: floor(640/5513×8) = 0 → vol still 8.

    describe("envelope decrease", () => {
        it("vol=8 pace=1: still 8 after 5 passes (640 < ENV_TICK)", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x81, 2040, false); // NR12=0x81: vol=8, dir=decrease, pace=1
            advancePasses(AudioRender.channel1, 5);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 8,
                "vol should still be 8 before first step");
        });

        it("vol=8 pace=1: steps to 7 after 6 passes (768 > ENV_TICK)", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x81, 2040, false);
            advancePasses(AudioRender.channel1, ENV_PASSES);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 7,
                "vol should be 7 after first envelope step");
        });

        it("vol=8 pace=1: decrements by 1 each step for 7 consecutive steps", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x81, 2040, false);
            for (let step = 0; step < 7; step++) {
                advancePasses(AudioRender.channel1, ENV_PASSES);
                assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), <u8>(8 - step - 1),
                    `vol after step ${step + 1}`);
            }
        });

        it("vol=1 pace=1: floors at 0 and stays there", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x11, 2040, false); // NR12=0x11: vol=1, decrease, pace=1
            advancePasses(AudioRender.channel1, ENV_PASSES); // one step: vol=0
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 0, "vol floored at 0");
            advancePasses(AudioRender.channel1, ENV_PASSES);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 0, "vol stays at 0");
        });
    });
}

// ─── Envelope: Increase ───────────────────────────────────────────────────────

function testEnvelopeIncrease(): void {
    // NR12 bit3=1 (increase). With vol=1, pace=1, increase:
    // totalSamples = round((15−1) × 689.06) = 9647.
    // After 6 passes (768): floor(768/9647×14) = 1 → vol = 1+1 = 2.

    describe("envelope increase", () => {
        it("vol=1 pace=1: still 1 after 5 passes (640 < ENV_TICK)", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x19, 2040, false); // NR12=0x19: vol=1, increase, pace=1
            advancePasses(AudioRender.channel1, 5);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 1,
                "vol should still be 1 before first step");
        });

        it("vol=1 pace=1: steps to 2 after 6 passes (768 > ENV_TICK)", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x19, 2040, false);
            advancePasses(AudioRender.channel1, ENV_PASSES);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 2,
                "vol should be 2 after first envelope step");
        });

        it("vol=1 pace=1: increments by 1 each step for 5 consecutive steps", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x19, 2040, false);
            for (let step = 0; step < 5; step++) {
                advancePasses(AudioRender.channel1, ENV_PASSES);
                assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), <u8>(1 + step + 1),
                    `vol after step ${step + 1}`);
            }
        });

        it("vol=14 pace=1: caps at 15 and stays there", () => {
            initAudio();
            triggerCH1(0, 0x80, 0xE9, 2040, false); // NR12=0xE9: vol=14, increase, pace=1
            advancePasses(AudioRender.channel1, ENV_PASSES);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 15, "vol reached 15");
            advancePasses(AudioRender.channel1, ENV_PASSES);
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 15, "vol stays at 15");
        });
    });
}

// ─── Envelope: Pace=0 Frozen ──────────────────────────────────────────────────

function testEnvelopePaceZeroFrozen(): void {
    // Pan Docs: pace=0 disables envelope (no stepping). Volume stays at initial forever.
    // EnvelopeEnabled = (SweepPace != 0) = false → GetCurrentEnvelopeVolume() = InitialVolume.

    describe("envelope pace=0 frozen", () => {
        it("volume stays at initial after many passes", () => {
            initAudio();
            triggerCH1(0, 0x80, 0xF0, 2040, false); // NR12=0xF0: vol=15, pace=0
            for (let i = 0; i < 20; i++) {
                advancePasses(AudioRender.channel1, ENV_PASSES);
                assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 15,
                    `vol frozen after ${(i + 1) * ENV_PASSES} passes`);
            }
        });

        it("all buffer samples are 0 or initial volume (no intermediate values)", () => {
            initAudio();
            triggerCH1(0, 0x80, 0x80, 2040, false); // vol=8, pace=0
            for (let pass = 0; pass < 10; pass++) {
                AudioRender.channel1.Render(0, BUF);
                for (let i = 0; i < BUF; i++) {
                    const v = AudioRender.channel1.Buffer[i];
                    assert(v == 0 || v == 8,
                        `pass ${pass} sample ${i}: expected 0 or 8, got ${v}`);
                }
            }
        });
    });
}

// ─── Length Counter: Stops Channel ───────────────────────────────────────────

function testLengthCounterStops(): void {
    // Pan Docs: CH1/CH2 play for (64 − NR11[5:0]) / 256 seconds when NR14 bit6=1.
    // samplesUntilStop = round((64 − lengthTimer) × SAMPLE_RATE / 256).
    //   LengthTimer=63 → round(1 × 172.27) = 172 samples.
    //   LengthTimer=60 → round(4 × 172.27) = 689 samples.

    describe("length counter stops channel", () => {
        it("CH1 LengthTimer=63: channel disabled after 172 samples (2 partial passes)", () => {
            initAudio();
            // NR11: duty=10(0x80) | length=63 = 0xBF
            triggerCH1(0, 0x80 | 63, 0xF0, 0x200, true);
            // 128 samples rendered: samplesUntilStop = 172−128 = 44 remaining
            AudioRender.channel1.Render(0, BUF);
            assert(AudioRender.channel1.Enabled, "channel still active after 128 samples (< 172)");
            // 44 more: 128+44=172 ≥ 172 → stopped
            AudioRender.channel1.Render(0, 44);
            assert(!AudioRender.channel1.Enabled, "channel should stop after 172 samples");
        });

        it("CH2 LengthTimer=60: channel disabled after 689 samples", () => {
            initAudio();
            // samplesUntilStop = round(4 × 172.27) = 689
            triggerCH2(0x80 | 60, 0xF0, 0x200, true);
            // 5 × 128 = 640 < 689: still running
            advancePasses(AudioRender.channel2, 5);
            assert(AudioRender.channel2.Enabled, "CH2 still enabled at 640 samples (< 689)");
            // 60 more: 640+60=700 ≥ 689 → stops
            AudioRender.channel2.Render(0, 60);
            assert(!AudioRender.channel2.Enabled, "CH2 should stop after 700 samples (> 689)");
        });

        it("output is 0 after channel stopped", () => {
            initAudio();
            triggerCH1(0, 0x80 | 63, 0xF0, 0x200, true);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.channel1.Render(0, 44);
            // additional render: channel disabled → Render returns immediately, buffer unchanged (all 0 from init)
            AudioRender.channel1.Render(0, BUF);
            assertEquals<i32>(countHigh(AudioRender.channel1), 0,
                "no non-zero samples when channel is stopped");
        });
    });
}

// ─── Length Counter: Disabled ─────────────────────────────────────────────────

function testLengthCounterDisabled(): void {
    // NR14 bit6=0: channel plays indefinitely regardless of NR11 length field.

    describe("length counter disabled", () => {
        it("CH1 LengthTimer=63 with NR14 bit6=0: still enabled after 1280 samples", () => {
            initAudio();
            triggerCH1(0, 0x80 | 63, 0xF0, 0x200, false); // lenEn=false
            advancePasses(AudioRender.channel1, 10); // 1280 >> 172
            assert(AudioRender.channel1.Enabled,
                "CH1 should remain enabled when length counter is off");
        });

        it("CH2 LengthTimer=63 with NR24 bit6=0: still enabled after 1280 samples", () => {
            initAudio();
            triggerCH2(0x80 | 63, 0xF0, 0x200, false);
            advancePasses(AudioRender.channel2, 10);
            assert(AudioRender.channel2.Enabled,
                "CH2 should remain enabled when length counter is off");
        });
    });
}

// ─── CH1 Sweep: Up (Add) ─────────────────────────────────────────────────────

function testCH1SweepUp(): void {
    // Pan Docs: NR10 bit3=0 (add mode). Each tick: period += period >> step.
    // period=0x200(512), step=1, pace=1: after 1 tick → period = 512+256 = 768.
    // f(512)=85Hz → f(768)=102Hz: frequency INCREASES → more rising edges.
    // Tick fires after SWEEP_PASSES × BUF = 384 > SWEEP_TICK=345 samples.

    describe("CH1 sweep up (add)", () => {
        it("channel remains enabled after valid sweep up (no overflow)", () => {
            initAudio();
            // NR10=0x14: pace=1, negate=0, step=4. period=1800 → 1912 → second check 2031 ≤ 2047
            triggerCH1(0x14, 0x80, 0xF0, 0x708, false);
            advancePasses(AudioRender.channel1, SWEEP_PASSES);
            assert(AudioRender.channel1.Enabled,
                "channel should remain enabled after valid sweep up");
        });

        it("frequency increases after sweep up tick (more rising edges)", () => {
            // period=1800(0x708), step=4(NR10=0x14): f=529Hz→964Hz after 1 tick.
            // delta=1800>>4=112, new=1912 ≤ 2047; second check: 1912+119=2031 ≤ 2047.
            // Before: ~3 rising edges in 256 samples; after: ~6 edges.
            initAudio();
            triggerCH1(0x14, 0x80, 0xF0, 0x708, false);
            const edgesBefore = renderAndCountRising(AudioRender.channel1, 2);

            initAudio();
            triggerCH1(0x14, 0x80, 0xF0, 0x708, false);
            advancePasses(AudioRender.channel1, SWEEP_PASSES); // 1 tick: period→1912
            const edgesAfter = renderAndCountRising(AudioRender.channel1, 2);

            assert(edgesAfter > edgesBefore,
                `edges after sweep up (${edgesAfter}) should exceed before (${edgesBefore})`);
        });
    });
}

// ─── CH1 Sweep: Down (Negate) ────────────────────────────────────────────────

function testCH1SweepDown(): void {
    // Pan Docs: NR10 bit3=1 (negate/subtract mode). Each tick: period −= period >> step.
    // period=0x300(768), step=1, pace=1: after 1 tick → period = 768−384 = 384.
    // f(768)=102Hz → f(384)=79Hz: frequency DECREASES → fewer rising edges.

    describe("CH1 sweep down (negate)", () => {
        it("channel remains enabled after sweep down (no underflow to 0)", () => {
            initAudio();
            // NR10=0x19: pace=1, negate=1 (bit3), step=1
            triggerCH1(0x19, 0x80, 0xF0, 0x300, false); // period=768
            advancePasses(AudioRender.channel1, SWEEP_PASSES);
            assert(AudioRender.channel1.Enabled,
                "channel should remain enabled after sweep down (768→384)");
        });

        it("frequency decreases after sweep down tick (fewer rising edges)", () => {
            // period=2000(0x7D0), NR10=0x1C(pace=1,negate=1,step=4): f=2730Hz→758Hz after 1 tick.
            // delta=2000>>4=125, new=1875 ≤ 2047; no overflow possible in negate mode.
            // Before: ~16 edges in 256 samples; after: ~4 edges.
            initAudio();
            triggerCH1(0x1C, 0x80, 0xF0, 0x7D0, false);
            const edgesBefore = renderAndCountRising(AudioRender.channel1, 2);

            initAudio();
            triggerCH1(0x1C, 0x80, 0xF0, 0x7D0, false);
            advancePasses(AudioRender.channel1, SWEEP_PASSES); // 1 tick: period→1875
            const edgesAfter = renderAndCountRising(AudioRender.channel1, 2);

            assert(edgesAfter < edgesBefore,
                `edges after sweep down (${edgesAfter}) should be less than before (${edgesBefore})`);
        });
    });
}

// ─── CH1 Sweep: Overflow Disables ────────────────────────────────────────────

function testCH1SweepOverflow(): void {
    // Pan Docs: if new period > 2047 during sweep, channel is immediately disabled.
    // period=0x700(1792), step=1: new = 1792+896 = 2688 > 2047 → overflow.
    // Also: step≠0 on trigger → immediate overflow check before first tick.

    describe("CH1 sweep overflow disables channel", () => {
        it("period=1000 step=1: channel disabled during first tick via second overflow check", () => {
            // Trigger check: 1000+500=1500 ≤ 2047 → channel stays enabled after trigger.
            // First tick (fires during 3rd pass at sample ~345): newPeriod=1500 written to shadow;
            // second check 1500+750=2250>2047 → disable().
            initAudio();
            triggerCH1(0x11, 0x80, 0xF0, 1000, false); // period=1000=0x3E8
            // 2 passes (256 < 345): tick not yet fired
            AudioRender.channel1.Render(0, BUF);
            AudioRender.channel1.Render(0, BUF);
            assert(AudioRender.channel1.Enabled, "channel enabled before sweep tick fires");
            // 3rd pass: tick fires, second overflow check (2250>2047) disables channel
            AudioRender.channel1.Render(0, BUF);
            assert(!AudioRender.channel1.Enabled,
                "channel disabled after sweep tick second overflow check (1500+750=2250>2047)");
        });

        it("immediate overflow check on trigger with step≠0: period=1400 step=1", () => {
            // 1400 + (1400>>1) = 1400+700 = 2100 > 2047 → disable() called inside trigger()
            initAudio();
            triggerCH1(0x11, 0x80, 0xF0, 1400, false);
            assert(!AudioRender.channel1.Enabled,
                "channel should be immediately disabled when trigger overflow occurs");
        });
    });
}

// ─── CH1 Sweep: Pace=0 ───────────────────────────────────────────────────────

function testCH1SweepPaceZero(): void {
    // Pan Docs (obscure): pace=0 → timer still runs (using effective pace=8), but no
    // frequency calculation is performed. Period stays constant indefinitely.
    // NR10=0x01: pace=0, negate=0, step=1 → sweepEnabled=true (step≠0), but tickSweep
    //   returns early ("if sweepPace==0 return") after reloading the timer.
    // Effective pace=8: first tick at 8×344.53=2756 samples ≈ 22 passes. Use 25 passes.

    describe("CH1 sweep pace=0", () => {
        it("frequency stays constant with pace=0 over 25 passes (timer runs silently)", () => {
            // period=0x400=1024 (step=1 trigger-check: 1024+512=1536≤2047 → no immediate disable).
            // With pace=0, tickSweep returns early on each tick → no frequency update.
            initAudio();
            triggerCH1(0x01, 0x80, 0xF0, 0x400, false); // NR10=0x01: pace=0, negate=0, step=1
            const edgesBefore = renderAndCountRising(AudioRender.channel1, 2);

            advancePasses(AudioRender.channel1, 25); // well past 8 effective-pace ticks
            const edgesAfter = renderAndCountRising(AudioRender.channel1, 2);

            assertEquals<i32>(edgesAfter, edgesBefore,
                "frequency must not change with pace=0 sweep");
        });

        it("channel stays enabled with pace=0 over 25 passes", () => {
            initAudio();
            triggerCH1(0x01, 0x80, 0xF0, 0x400, false);
            advancePasses(AudioRender.channel1, 25);
            assert(AudioRender.channel1.Enabled,
                "channel should remain enabled with pace=0");
        });
    });
}

// ─── CH1 Sweep: Negate→Add Edge Case ─────────────────────────────────────────

function testCH1NegateAddDisable(): void {
    // Pan Docs (obscure): if negate mode was used during the current trigger cycle and then
    // NR10's negate bit is cleared, the channel is immediately disabled.
    // Observed on DMG/CGB as protection against abuse of the subtract mode to compute
    // frequencies that would normally overflow in add mode.

    describe("CH1 negate→add trigger disables channel", () => {
        it("clearing negate after subtraction used disables channel", () => {
            initAudio();
            // Step 1: trigger with negate=1 (NR10=0x19: pace=1, negate=1, step=1)
            triggerCH1(0x19, 0x80, 0xF0, 0x300, false); // period=768
            // Fire one tick → sweepNegateUsed=true
            advancePasses(AudioRender.channel1, SWEEP_PASSES);
            assert(AudioRender.channel1.Enabled, "channel enabled after negate tick");

            // Step 2: write NR10 with negate=0 → HandleSweepEvent detects
            //   (sweepNegate && !newNegate && sweepNegateUsed) → disable()
            MemoryMap.GBstore<u8>(0xFF10, 0x11); // pace=1, negate=0, step=1
            flushAudioEvents();
            assert(!AudioRender.channel1.Enabled,
                "channel should be disabled when negate cleared after subtraction was used");
        });
    });
}

// ─── Trigger Resets Envelope ─────────────────────────────────────────────────

function testTriggerResetsEnvelope(): void {
    // Pan Docs: writing NR14/NR24 bit7=1 (trigger) restores EnvelopeLeft=1.0,
    // re-enables the channel, and reloads the sweep shadow register.
    // Phase is NOT reset by trigger (only by Init/Reset).

    describe("trigger resets envelope", () => {
        it("re-trigger restores volume to initial after partial decay", () => {
            initAudio();
            // vol=15, decrease, pace=1
            triggerCH1(0, 0x80, 0xF1, 2040, false);
            // Decay 6 steps: vol = 15−6 = 9
            for (let i = 0; i < 6; i++) advancePasses(AudioRender.channel1, ENV_PASSES);
            assert(AudioRender.channel1.GetCurrentEnvelopeVolume() < 15,
                "vol should have decayed before re-trigger");

            // Re-trigger by writing NR14 bit7 (keep same period high bits)
            MemoryMap.GBstore<u8>(0xFF14, 0x80 | <u8>((2040 >> 8) & 0x7));
            flushAudioEvents();
            assertEquals<u8>(AudioRender.channel1.GetCurrentEnvelopeVolume(), 15,
                "vol should be restored to 15 after re-trigger");
        });

        it("re-trigger re-enables a channel stopped by length counter", () => {
            initAudio();
            // LengthTimer=63 → stops after 172 samples
            triggerCH1(0, 0x80 | 63, 0xF0, 0x200, true);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.channel1.Render(0, 44);
            assert(!AudioRender.channel1.Enabled, "channel stopped by length counter");

            // Re-trigger: NR14 bit7 + bit6 (length enable) + period high=2
            MemoryMap.GBstore<u8>(0xFF14, 0x80 | 0x40 | 0x02);
            flushAudioEvents();
            assert(AudioRender.channel1.Enabled, "channel re-enabled after trigger");
        });

        it("CH2 re-trigger restores volume after decay", () => {
            initAudio();
            triggerCH2(0x80, 0xF1, 2040, false); // vol=15, decrease, pace=1
            for (let i = 0; i < 4; i++) advancePasses(AudioRender.channel2, ENV_PASSES);
            const decayed = AudioRender.channel2.GetCurrentEnvelopeVolume();
            assert(decayed < 15, `vol should have decayed (got ${decayed})`);

            MemoryMap.GBstore<u8>(0xFF19, 0x80 | <u8>((2040 >> 8) & 0x7));
            flushAudioEvents();
            assertEquals<u8>(AudioRender.channel2.GetCurrentEnvelopeVolume(), 15,
                "CH2 vol restored after re-trigger");
        });
    });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function testPulseChannel(): boolean {
    testDutyCycles();
    testFrequencyPeriodEncoding();
    testEnvelopeInitialVolume();
    testEnvelopeDecrease();
    testEnvelopeIncrease();
    testEnvelopePaceZeroFrozen();
    testLengthCounterStops();
    testLengthCounterDisabled();
    testCH1SweepUp();
    testCH1SweepDown();
    testCH1SweepOverflow();
    testCH1SweepPaceZero();
    testCH1NegateAddDisable();
    testTriggerResetsEnvelope();
    return true;
}
