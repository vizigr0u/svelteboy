import { MemoryMap } from "../memory/memoryMap";
import { AudioRender } from "../audio/render";
import { AudioEventQueue } from "../audio/eventQueue";
import { WaveChannel } from "../audio/WaveChannel";
import { describe, it, assertEquals } from "./framework";
import { setTestRom } from "./cpuTests";

// Buffer size per Render call
const BUF: i32 = 128;

// period=0x7FF: angularFreq = 2097152/1/44100 ≈ 47.6 phases/sample (very fast, wraps in 1 sample)
const MAX_PERIOD: u16 = 0x7FF;

// period=0x780 (1920): angularFreq = 2097152/128/44100 ≈ 0.372 phases/sample
// One 32-sample cycle ≈ 86 audio samples → ~4.5 cycles in 384 samples (3 passes)
const MID_PERIOD: u16 = 0x780;

// period=0x700 (1792): angularFreq = 2097152/256/44100 ≈ 0.186 phases/sample
// One cycle ≈ 172 audio samples → ~2.2 cycles in 384 samples (3 passes)
const SLOW_PERIOD: u16 = 0x700;

// NR32 byte values — bits 6-5 select output level
const LEVEL_MUTE: u8    = 0x00; // bits 6-5=00 → OutputLevel.Mute
const LEVEL_MAX: u8     = 0x20; // bits 6-5=01 → 100% (no shift)
const LEVEL_HALF: u8    = 0x40; // bits 6-5=10 → 50%  (>>1)
const LEVEL_QUARTER: u8 = 0x60; // bits 6-5=11 → 25%  (>>2)

// CH3 length: (256 - NR31) / 256 seconds.
// NR31=255 → 1/256 sec = round(1 × 44100/256) = 172 samples
// NR31=252 → 4/256 sec = round(4 × 44100/256) = 689 samples
const LEN_TICK: i32 = 172; // samples per 1/256 second

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

// Fill all 16 wave RAM bytes ($FF30-$FF3F) with `value`.
function fillWaveRam(value: u8): void {
    for (let i = 0; i < 16; i++) {
        MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), value);
    }
    flushAudioEvents();
}

// level = NR32 byte; period = 11-bit period; lengthVal = NR31; lenEn = NR34 bit 6
function triggerCH3(level: u8, period: u16, lengthVal: u8, lenEn: bool): void {
    MemoryMap.GBstore<u8>(0xFF1A, 0x80); // NR30: DAC on
    MemoryMap.GBstore<u8>(0xFF1B, lengthVal);
    MemoryMap.GBstore<u8>(0xFF1C, level);
    MemoryMap.GBstore<u8>(0xFF1D, <u8>(period & 0xFF));
    MemoryMap.GBstore<u8>(0xFF1E, 0x80 | (lenEn ? 0x40 : 0x00) | <u8>((period >> 8) & 0x7));
    flushAudioEvents();
}

function ch3(): WaveChannel { return AudioRender.channel3; }

function advancePasses(passes: i32): void {
    for (let p = 0; p < passes; p++) {
        ch3().Render(0, BUF);
    }
}

// Count falling edges (nonzero → 0) across one render pass.
function countFallingEdges(prevLast: u8): i32 {
    let n = 0;
    if (ch3().Buffer[0] == 0 && prevLast > 0) n++;
    for (let i = 1; i < BUF; i++) {
        if (ch3().Buffer[i] == 0 && ch3().Buffer[i - 1] > 0) n++;
    }
    return n;
}

function renderAndCountFalling(passes: i32): i32 {
    let n = 0;
    let prev: u8 = ch3().Buffer[BUF - 1];
    for (let p = 0; p < passes; p++) {
        ch3().Render(0, BUF);
        n += countFallingEdges(prev);
        prev = ch3().Buffer[BUF - 1];
    }
    return n;
}

// ─── Wave RAM Round-Trip ──────────────────────────────────────────────────────

function testWaveRamRoundTrip(): void {
    // Write 16 distinct bytes to $FF30-$FF3F, read back via GBload.
    // Wave events pass through unchanged (AudioRegisters.getChange returns newValue).
    describe("Wave RAM round-trip", () => {
        it("write and read back distinct values via $FF30-$FF3F", () => {
            initAudio();
            for (let i = 0; i < 16; i++) {
                MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), <u8>(0xA0 + i));
            }
            for (let i = 0; i < 16; i++) {
                const got = MemoryMap.GBload<u8>(<u16>(0xFF30 + i));
                assertEquals<u8>(got, <u8>(0xA0 + i),
                    `Wave RAM byte ${i}: expected 0x${(0xA0 + i).toString(16)}`);
            }
        });

        it("write 0xAB, 0xCD pattern and read back", () => {
            initAudio();
            for (let i = 0; i < 16; i++) {
                MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), i % 2 == 0 ? 0xAB : 0xCD);
            }
            for (let i = 0; i < 16; i++) {
                const expected: u8 = i % 2 == 0 ? 0xAB : 0xCD;
                assertEquals<u8>(MemoryMap.GBload<u8>(<u16>(0xFF30 + i)), expected,
                    `Wave RAM byte ${i}`);
            }
        });

        it("overwrite with new values", () => {
            initAudio();
            fillWaveRam(0xFF);
            MemoryMap.GBstore<u8>(0xFF30, 0x12);
            MemoryMap.GBstore<u8>(0xFF3F, 0x34);
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF30), 0x12, "0xFF30 overwritten");
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF3F), 0x34, "0xFF3F overwritten");
        });
    });
}

// ─── Output Level: Mute ───────────────────────────────────────────────────────

function testOutputLevelMute(): void {
    // NR32 bits 6-5 = 00 → OutputLevel.Mute → Render fills buffer with 0 regardless of wave data.
    describe("output level mute", () => {
        it("all rendered samples are 0 (NR32=0x00, wave=0xFF)", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MUTE, MID_PERIOD, 0, false);
            ch3().Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                assertEquals<u8>(ch3().Buffer[i], 0, `sample ${i} should be 0 (mute)`);
            }
        });

        it("mute output persists over multiple passes", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MUTE, MID_PERIOD, 0, false);
            advancePasses(4);
            ch3().Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                assertEquals<u8>(ch3().Buffer[i], 0, `sample ${i} still 0 after 5 passes`);
            }
        });
    });
}

// ─── Output Level: Max (100%) ─────────────────────────────────────────────────

function testOutputLevelMax(): void {
    // NR32 bits 6-5 = 01 → OutputLevel.Max → shift=0 → samples equal raw nibble value.
    // wave=0xFF → all nibbles = 0xF. All enabled samples must equal 0xF.
    describe("output level max (100%)", () => {
        it("all samples equal raw nibble value 0xF (wave=0xFF, NR32=0x20)", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MAX, MID_PERIOD, 0, false);
            ch3().Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                assertEquals<u8>(ch3().Buffer[i], 0xF, `sample ${i} should be 0xF`);
            }
        });
    });
}

// ─── Output Level: Half (50%) ─────────────────────────────────────────────────

function testOutputLevelHalf(): void {
    // NR32 bits 6-5 = 10 → OutputLevel.Half → shift=1 → samples = nibble >> 1.
    // wave=0xFF → nibble=0xF → 0xF >> 1 = 0x7.
    describe("output level half (50%)", () => {
        it("all samples equal 0xF >> 1 = 0x7 (wave=0xFF, NR32=0x40)", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_HALF, MID_PERIOD, 0, false);
            ch3().Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                assertEquals<u8>(ch3().Buffer[i], 0x7, `sample ${i} should be 0x7`);
            }
        });
    });
}

// ─── Output Level: Quarter (25%) ─────────────────────────────────────────────

function testOutputLevelQuarter(): void {
    // NR32 bits 6-5 = 11 → OutputLevel.Quarter → shift=2 → samples = nibble >> 2.
    // wave=0xFF → nibble=0xF → 0xF >> 2 = 0x3.
    describe("output level quarter (25%)", () => {
        it("all samples equal 0xF >> 2 = 0x3 (wave=0xFF, NR32=0x60)", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_QUARTER, MID_PERIOD, 0, false);
            ch3().Render(0, BUF);
            for (let i = 0; i < BUF; i++) {
                assertEquals<u8>(ch3().Buffer[i], 0x3, `sample ${i} should be 0x3`);
            }
        });

        it("level ordering: mute(0) < quarter(3) < half(7) < max(15)", () => {
            // Render 1 sample per level with all-0xF wave, check values decrease.
            initAudio();
            fillWaveRam(0xFF);

            triggerCH3(LEVEL_MAX, MID_PERIOD, 0, false);
            ch3().Render(0, 1);
            const vMax = ch3().Buffer[0];

            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_HALF, MID_PERIOD, 0, false);
            ch3().Render(0, 1);
            const vHalf = ch3().Buffer[0];

            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_QUARTER, MID_PERIOD, 0, false);
            ch3().Render(0, 1);
            const vQtr = ch3().Buffer[0];

            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MUTE, MID_PERIOD, 0, false);
            ch3().Render(0, 1);
            const vMute = ch3().Buffer[0];

            assert(vMute == 0, `mute must be 0, got ${vMute}`);
            assert(vMute < vQtr && vQtr < vHalf && vHalf < vMax,
                `level ordering violated: mute=${vMute} qtr=${vQtr} half=${vHalf} max=${vMax}`);
            assertEquals<u8>(vMax, 0xF, "max level = 0xF");
            assertEquals<u8>(vHalf, 0x7, "half level = 0x7");
            assertEquals<u8>(vQtr, 0x3, "quarter level = 0x3");
        });
    });
}

// ─── Frequency Encoding ───────────────────────────────────────────────────────

function testFrequencyEncoding(): void {
    // Pan Docs: wave sample rate = 2097152 / (2048 - period) Hz (NOT 1048576 like pulse).
    // Wave frequency = 65536 / (2048 - period) Hz.
    // Test: count full wave cycles (falling edges) in 384 samples at two periods.
    // Wave pattern: bytes 0x00 for $FF30-$FF37 (waveData[0..15]=0),
    //               bytes 0xFF for $FF38-$FF3F (waveData[16..31]=0xF).
    // One falling edge per complete 32-sample cycle.
    //
    // period=0x780: angularFreq=0.372, cycles in 384 = 4.46 → expect 3-6 edges.
    // period=0x700: angularFreq=0.186, cycles in 384 = 2.23 → expect 1-4 edges.
    // If wave used pulse divisor (1048576): period=0x780 would give only ~2.2 cycles.
    describe("frequency encoding (wave uses 2097152 divisor)", () => {
        it("period=0x780: 3-6 falling edges in 384 samples (verifies 2097152 divisor)", () => {
            initAudio();
            for (let i = 0; i < 8; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            for (let i = 8; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0xFF);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, MID_PERIOD, 0, false);
            const edges = renderAndCountFalling(3);
            assert(edges >= 3 && edges <= 6,
                `period=0x780 should give 3-6 falling edges in 384 samples, got ${edges}`);
        });

        it("period=0x700: 1-4 falling edges in 384 samples", () => {
            initAudio();
            for (let i = 0; i < 8; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            for (let i = 8; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0xFF);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, SLOW_PERIOD, 0, false);
            const edges = renderAndCountFalling(3);
            assert(edges >= 1 && edges <= 4,
                `period=0x700 should give 1-4 falling edges in 384 samples, got ${edges}`);
        });

        it("higher period → more cycles (period=0x780 has more edges than period=0x700)", () => {
            initAudio();
            for (let i = 0; i < 8; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            for (let i = 8; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0xFF);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, MID_PERIOD, 0, false);
            const edgesFast = renderAndCountFalling(3);

            initAudio();
            for (let i = 0; i < 8; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            for (let i = 8; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0xFF);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, SLOW_PERIOD, 0, false);
            const edgesSlow = renderAndCountFalling(3);

            assert(edgesFast > edgesSlow,
                `period=0x780 should have more cycles than period=0x700 (${edgesFast} vs ${edgesSlow})`);
        });
    });
}

// ─── Phase Wraps at 32 ────────────────────────────────────────────────────────

function testPhaseWraps(): void {
    // Phase advances each sample; wraps via `phase -= 32.0` when phase >= 32.
    // Without wrap, waveData would be accessed with index >= 32 → crash or silence.
    // Use half-high wave (bytes 0-7=0x00, bytes 8-15=0xFF) at MID_PERIOD.
    // After many passes, cycles should still be counted → wrap is working.
    describe("phase wraps at 32", () => {
        it("channel stays enabled and samples cycle correctly over 10 passes (1280 samples)", () => {
            initAudio();
            for (let i = 0; i < 8; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            for (let i = 8; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0xFF);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, MID_PERIOD, 0, false);
            advancePasses(10);
            assert(ch3().Enabled, "channel should still be enabled after 1280 samples");
        });

        it("wave pattern repeats over multiple cycles (nonzero + zero samples both appear)", () => {
            initAudio();
            for (let i = 0; i < 8; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            for (let i = 8; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0xFF);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, MID_PERIOD, 0, false);
            // Need >1 full cycle (86 samples) to see both halves
            advancePasses(2); // 256 > 86
            ch3().Render(0, BUF);
            let hasZero = false;
            let hasHigh = false;
            for (let i = 0; i < BUF; i++) {
                if (ch3().Buffer[i] == 0) hasZero = true;
                if (ch3().Buffer[i] == 0xF) hasHigh = true;
            }
            assert(hasZero, "should see zero samples (first half of wave)");
            assert(hasHigh, "should see 0xF samples (second half of wave)");
        });
    });
}

// ─── Trigger Resets Phase to 1 ───────────────────────────────────────────────

function testTriggerResetsPhase(): void {
    // Pan Docs: after trigger, sample index resets; first sample always from waveData[1].
    // Impl: Reset() sets phase=1.0; trigger() must call Reset() so retriggering
    //       always restarts from waveData[1] regardless of current phase.
    //
    // Test wave: $FF30=0xF0 → waveData[0]=0 (lower nibble), waveData[1]=0xF (upper nibble).
    //            All other bytes = 0x00.
    // period=0x7FF: angularFreq≈47.6 → after 1 sample, phase advances far past index 1.
    describe("trigger resets phase to 1", () => {
        it("first sample after trigger is waveData[1] (upper nibble of $FF30)", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF30, 0xF0); // waveData[0]=0, waveData[1]=0xF
            for (let i = 1; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, MAX_PERIOD, 0, false);
            ch3().Render(0, 1);
            assertEquals<u8>(ch3().Buffer[0], 0xF,
                "first sample after trigger should be waveData[1]=0xF (phase=1.0)");
        });

        it("retrigger after phase advanced resets back to waveData[1]", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF30, 0xF0);
            for (let i = 1; i < 16; i++) MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), 0x00);
            flushAudioEvents();
            triggerCH3(LEVEL_MAX, MAX_PERIOD, 0, false);
            // Render 2 samples: at angularFreq≈47.6, phase[1] ≈ 48.6 → wraps, lands far from 1.
            ch3().Render(0, 2);
            // Sample [1] should NOT be 0xF (phase has advanced away from index 1)
            assertEquals<u8>(ch3().Buffer[1], 0,
                "sample[1] should be 0 (phase moved past waveData[1])");
            // Retrigger — must reset phase to 1.0
            triggerCH3(LEVEL_MAX, MAX_PERIOD, 0, false);
            ch3().Render(0, 1);
            assertEquals<u8>(ch3().Buffer[0], 0xF,
                "first sample after retrigger should be 0xF (phase reset to 1.0)");
        });
    });
}

// ─── Length Counter ───────────────────────────────────────────────────────────

function testLengthCounter(): void {
    // Pan Docs: CH3 length = (256 - NR31) / 256 seconds (8-bit timer, max 256).
    // samplesUntilStop = round((256 - NR31) * SAMPLE_RATE / 256).
    //   NR31=255 → round(1 × 172.27) = 172 samples.
    //   NR31=252 → round(4 × 172.27) = 689 samples.
    // Note: differs from CH1/CH2 which use 6-bit timer (max 64).
    describe("length counter (CH3, 8-bit, max 256)", () => {
        it("NR31=255: channel disabled after 172 samples (> 128, stops before 172+44)", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MAX, MID_PERIOD, 255, true);
            // 128 samples rendered: samplesUntilStop = 172−128 = 44 remaining
            ch3().Render(0, BUF);
            assert(ch3().Enabled, "channel still active after 128 samples (< 172)");
            // 44 more: 128+44 = 172 ≥ 172 → stopped
            ch3().Render(0, 44);
            assert(!ch3().Enabled, "channel should stop after 172 samples (NR31=255)");
        });

        it("NR31=252: channel disabled after ~689 samples", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MAX, MID_PERIOD, 252, true);
            // 5 × 128 = 640 < 689: still running
            advancePasses(5);
            assert(ch3().Enabled, "CH3 still enabled at 640 samples (< 689)");
            // 60 more: 640+60 = 700 ≥ 689 → stops
            ch3().Render(0, 60);
            assert(!ch3().Enabled, "CH3 should stop after 700 samples (> 689)");
        });

        it("output is 0 after length counter stops channel", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MAX, MID_PERIOD, 255, true);
            ch3().Render(0, BUF);
            ch3().Render(0, 44); // channel stops here
            // Buffer was written while enabled; now render one more pass (disabled)
            ch3().Render(0, BUF);
            let nonZero = 0;
            for (let i = 0; i < BUF; i++) {
                if (ch3().Buffer[i] != 0) nonZero++;
            }
            assertEquals<i32>(nonZero, 0,
                "no non-zero samples when channel is stopped by length counter");
        });

        it("length counter disabled: channel plays indefinitely (NR34 bit6=0)", () => {
            initAudio();
            fillWaveRam(0xFF);
            triggerCH3(LEVEL_MAX, MID_PERIOD, 255, false); // lenEn=false
            advancePasses(10); // 1280 >> 172
            assert(ch3().Enabled,
                "CH3 should remain enabled when length counter is off");
        });
    });
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export function testWaveChannel(): boolean {
    testWaveRamRoundTrip();
    testOutputLevelMute();
    testOutputLevelMax();
    testOutputLevelHalf();
    testOutputLevelQuarter();
    testFrequencyEncoding();
    testPhaseWraps();
    testTriggerResetsPhase();
    testLengthCounter();
    return true;
}
