import { MemoryMap } from "../memory/memoryMap";
import { AudioRender } from "../audio/render";
import { AudioEventQueue } from "../audio/eventQueue";
import { NoiseChannel } from "../audio/NoiseChannel";
import { describe, it, assertEquals } from "./framework";
import { setTestRom } from "./cpuTests";

const BUF: i32 = 128;
// Samples per envelope step at pace=1: ceil(44100/64) = 690
const ENV_TICK: i32 = 690;
// 6×128=768 > 690: one full envelope step
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

function ch4(): NoiseChannel { return AudioRender.channel4; }

// NR43: bits 7-4=shift, bit3=1 for 7-bit mode, bits 2-0=divider
function makeNR43(shift: u8, shortMode: bool, divider: u8): u8 {
    return (<u8>(shift << 4)) | (shortMode ? 0x08 : 0x00) | (divider & 0x07);
}

function triggerCH4(nr43: u8, vol: u8, lengthVal: u8, lenEn: bool): void {
    MemoryMap.GBstore<u8>(0xFF20, lengthVal);
    MemoryMap.GBstore<u8>(0xFF21, vol);
    MemoryMap.GBstore<u8>(0xFF22, nr43);
    MemoryMap.GBstore<u8>(0xFF23, 0x80 | (lenEn ? 0x40 : 0x00));
    flushAudioEvents();
}

function advancePasses(passes: i32): void {
    for (let p = 0; p < passes; p++) {
        ch4().Render(0, BUF);
    }
}

function countNonzero(len: i32): i32 {
    let n = 0;
    for (let i = 0; i < len; i++) {
        if (ch4().Buffer[i] > 0) n++;
    }
    return n;
}

// ─── Trigger Reinitializes LFSR ──────────────────────────────────────────────

function testLfsrReset(): void {
    // Pan Docs: LFSR is set to 0 when (re)triggering the channel.
    // NoiseChannel.Reset() sets Lsfr=0. First sample output uses LFSR before first tick,
    // so Buffer[0] = 0 (bit0=0 → no volume).
    describe("trigger reinitializes LFSR to 0", () => {
        it("LFSR=0 immediately after trigger", () => {
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            assertEquals<u16>(ch4().Lsfr, 0, "LFSR should be 0 after trigger");
        });

        it("first rendered sample is 0 (LFSR bit0=0 after reset)", () => {
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            ch4().Render(0, 1);
            assertEquals<u8>(ch4().Buffer[0], 0, "first sample is 0 (LFSR bit0=0)");
        });

        it("retrigger resets LFSR back to 0 mid-sequence", () => {
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            ch4().Render(0, BUF);
            assert(ch4().Lsfr != 0, "LFSR should have advanced from render");
            // Retrigger
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            assertEquals<u16>(ch4().Lsfr, 0, "LFSR should be 0 after retrigger");
        });
    });
}

// ─── LFSR 15-bit Feedback Sequence ───────────────────────────────────────────

function testLfsr15BitSequence(): void {
    // Pan Docs: on each tick, bit15 = XNOR(bit0, bit1); shift right.
    // Starting from LFSR=0 (all bits 0): XNOR(0,0)=1, bit15 set, shift → 0x4000.
    // Trace: 0→0x4000→0x6000→0x7000 for first 3 ticks (both bits 0 every time until
    // the high bits shift down). Verified by direct TickLsfr() calls.
    describe("LFSR 15-bit feedback sequence", () => {
        it("after 1 tick from 0: LFSR=0x4000", () => {
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr, 0x4000, "LFSR after 1 tick");
        });

        it("after 2 ticks from 0: LFSR=0x6000", () => {
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            ch4().TickLsfr();
            ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr, 0x6000, "LFSR after 2 ticks");
        });

        it("after 3 ticks from 0: LFSR=0x7000", () => {
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            ch4().TickLsfr(); ch4().TickLsfr(); ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr, 0x7000, "LFSR after 3 ticks");
        });

        it("after 15 ticks from 0: LFSR=0x3FFF (bit0=1 → first volume output)", () => {
            // At tick 15: bit1 of the pre-tick LFSR (0x7FFE) is 1 but bit0=0 → XNOR=0,
            // bit15=0, shift → 0x3FFF (bit0=1).
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            for (let i = 0; i < 15; i++) ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr, 0x3FFF, "LFSR after 15 ticks");
        });
    });
}

// ─── LFSR 7-bit Short Mode ───────────────────────────────────────────────────

function testLfsr7BitShortMode(): void {
    // Pan Docs NR43 bit3=1: 7-bit mode. After each tick, bit15 is also copied to bit7.
    // This creates a shorter 127-cycle period (vs 32767 for 15-bit).
    // From LFSR=0: tick1 → 0x4040 (both bit15 and bit7 set then shifted).
    describe("LFSR 7-bit short mode", () => {
        it("after 1 tick from 0: LFSR=0x4040 (bit7 also set)", () => {
            initAudio();
            triggerCH4(makeNR43(0, true, 1), 0xF0, 0, false);
            ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr, 0x4040, "LFSR 7-bit after 1 tick");
        });

        it("after 2 ticks from 0: LFSR=0x6060", () => {
            initAudio();
            triggerCH4(makeNR43(0, true, 1), 0xF0, 0, false);
            ch4().TickLsfr(); ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr, 0x6060, "LFSR 7-bit after 2 ticks");
        });

        it("after 3 ticks from 0: LFSR=0x7070", () => {
            initAudio();
            triggerCH4(makeNR43(0, true, 1), 0xF0, 0, false);
            ch4().TickLsfr(); ch4().TickLsfr(); ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr, 0x7070, "LFSR 7-bit after 3 ticks");
        });

        it("7-bit sequence differs from 15-bit after 3 ticks", () => {
            // 15-bit: 0x7000; 7-bit: 0x7070. Bit7 feedback makes them diverge.
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false);
            ch4().TickLsfr(); ch4().TickLsfr(); ch4().TickLsfr();
            const lsfr15 = ch4().Lsfr;

            initAudio();
            triggerCH4(makeNR43(0, true, 1), 0xF0, 0, false);
            ch4().TickLsfr(); ch4().TickLsfr(); ch4().TickLsfr();
            const lsfr7 = ch4().Lsfr;

            assert(lsfr15 != lsfr7,
                `15-bit (${lsfr15}) and 7-bit (${lsfr7}) produce different sequences`);
        });

        it("7-bit produces first nonzero output earlier than 15-bit (after 7 vs 15 ticks)", () => {
            // 7-bit: bit0=1 first at tick 7 → first nonzero sample ~264 samples in (shift=5, div=7)
            // 15-bit: bit0=1 first at tick 15 → first nonzero sample ~565 samples
            // After 3 passes (384 samples) at shift=5 div=7: 7-bit has nonzero, 15-bit does not.
            // samples/tick ≈ 44100×7/(262144>>5) ≈ 37.7
            initAudio();
            triggerCH4(makeNR43(5, true, 7), 0xF0, 0, false); // 7-bit, shift=5, div=7
            advancePasses(3);
            const nonzero7 = countNonzero(BUF);
            ch4().Render(0, BUF);

            initAudio();
            triggerCH4(makeNR43(5, false, 7), 0xF0, 0, false); // 15-bit, shift=5, div=7
            advancePasses(3);
            const nonzero15 = countNonzero(BUF);
            ch4().Render(0, BUF);

            assert(nonzero7 > 0,
                `7-bit mode should have nonzero output by pass 3 (got ${nonzero7})`);
            assertEquals<i32>(nonzero15, 0,
                "15-bit mode should still output 0 at pass 3 (tick 15 not reached yet)");
        });
    });
}

// ─── Clock Divider 0 Special Case ────────────────────────────────────────────

function testClockDivider0(): void {
    // Pan Docs NR43 bits 2-0: divider, with 0 treated as 0.5.
    // LFSR freq = 262144/(divider × 2^shift) Hz; divider=0 → 524288/2^shift Hz.
    // So divider=0 ticks at 2× the rate of divider=1.
    // Test: after 50 samples with shift=5, divider=0 reaches tick 15 (first nonzero at ~40 samples),
    // while divider=1 has only ~9 ticks (first nonzero requires 81 samples → all still 0).
    // samples/tick: div=0 → 44100/16384 ≈ 2.69; div=1 → 44100/8192 ≈ 5.38
    describe("clock divider 0 special case (maps to 0.5, 2× frequency of divider 1)", () => {
        it("divider=0 reaches first nonzero output before divider=1 at same shift", () => {
            initAudio();
            triggerCH4(makeNR43(5, false, 0), 0xF0, 0, false); // shift=5, div=0
            ch4().Render(0, 50);
            const nonzero0 = countNonzero(50);

            initAudio();
            triggerCH4(makeNR43(5, false, 1), 0xF0, 0, false); // shift=5, div=1
            ch4().Render(0, 50);
            const nonzero1 = countNonzero(50);

            assert(nonzero0 > 0,
                `divider=0 should have nonzero output after 50 samples (got ${nonzero0})`);
            assertEquals<i32>(nonzero1, 0,
                "divider=1 should still be all-zero after 50 samples (tick 15 not reached)");
        });

        it("divider=0 advances LFSR further than divider=1 in same sample count", () => {
            initAudio();
            triggerCH4(makeNR43(5, false, 0), 0xF0, 0, false);
            ch4().Render(0, BUF);
            const lsfr0 = ch4().Lsfr;

            initAudio();
            triggerCH4(makeNR43(5, false, 1), 0xF0, 0, false);
            ch4().Render(0, BUF);
            const lsfr1 = ch4().Lsfr;

            assert(lsfr0 != lsfr1,
                `divider=0 (${lsfr0}) and divider=1 (${lsfr1}) should be at different LFSR positions`);
        });
    });
}

// ─── Clock Shift → Frequency ─────────────────────────────────────────────────

function testClockShift(): void {
    // Pan Docs: LFSR freq = 262144/(divider × 2^shift) Hz. Higher shift → lower freq → fewer ticks.
    // shift=2, div=1: freq=65536 Hz, samples/tick≈0.67 → ~190 ticks / 128 samples → lots of nonzero.
    // shift=6, div=1: freq=4096 Hz, samples/tick≈10.8 → ~12 ticks / 128 samples → still all zeros
    //   (first nonzero at tick 15 ≈ 162 samples > 128).
    describe("clock shift: higher shift → lower frequency → fewer LFSR ticks", () => {
        it("shift=2 produces nonzero output within 128 samples (fast clock)", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0xF0, 0, false);
            ch4().Render(0, BUF);
            const nonzero = countNonzero(BUF);
            assert(nonzero > 0,
                `shift=2 should produce nonzero output in 128 samples (got ${nonzero})`);
        });

        it("shift=6 produces no nonzero output within 128 samples (slow clock)", () => {
            // tick 15 requires 162 samples at shift=6/div=1; 128 < 162 → all zeros
            initAudio();
            triggerCH4(makeNR43(6, false, 1), 0xF0, 0, false);
            ch4().Render(0, BUF);
            const nonzero = countNonzero(BUF);
            assertEquals<i32>(nonzero, 0,
                "shift=6 should still be all-zero after 128 samples (tick 15 not reached)");
        });

        it("lower shift → more nonzero samples than higher shift", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0xF0, 0, false);
            ch4().Render(0, BUF);
            const nonzeroFast = countNonzero(BUF);

            initAudio();
            triggerCH4(makeNR43(6, false, 1), 0xF0, 0, false);
            ch4().Render(0, BUF);
            const nonzeroSlow = countNonzero(BUF);

            assert(nonzeroFast > nonzeroSlow,
                `shift=2 (${nonzeroFast}) should have more nonzero than shift=6 (${nonzeroSlow})`);
        });
    });
}

// ─── Envelope ────────────────────────────────────────────────────────────────

function testEnvelope(): void {
    // CH4 envelope behaves identically to CH1/CH2 (same AudioChannelBase).
    // NR42 bits 7-4 = initial volume, bit 3 = direction (1=increase), bits 2-0 = pace.
    // Decrease: vol=8 pace=1 → steps to 7 after 1 ENV_TICK (690 samples).
    // Increase: vol=1 pace=1 → steps to 2 after 1 ENV_TICK.
    describe("envelope decay and attack", () => {
        it("vol=8 pace=1 decrease: still 8 after 5 passes (< ENV_TICK)", () => {
            initAudio();
            // NR42=0x81: vol=8, direction=decrease, pace=1
            triggerCH4(makeNR43(2, false, 1), 0x81, 0, false);
            advancePasses(5);
            assertEquals<u8>(ch4().GetCurrentEnvelopeVolume(), 8,
                "vol should still be 8 before first envelope step");
        });

        it("vol=8 pace=1 decrease: steps to 7 after 6 passes (> ENV_TICK)", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0x81, 0, false);
            advancePasses(ENV_PASSES);
            assertEquals<u8>(ch4().GetCurrentEnvelopeVolume(), 7,
                "vol should be 7 after first envelope step");
        });

        it("vol=8 pace=1 decrease: 7 consecutive steps each decrement by 1", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0x81, 0, false);
            for (let step = 0; step < 7; step++) {
                advancePasses(ENV_PASSES);
                assertEquals<u8>(ch4().GetCurrentEnvelopeVolume(), <u8>(8 - step - 1),
                    `vol after step ${step + 1}`);
            }
        });

        it("vol=1 pace=1 increase: steps to 2 after 6 passes", () => {
            initAudio();
            // NR42=0x19: vol=1, direction=increase, pace=1
            triggerCH4(makeNR43(2, false, 1), 0x19, 0, false);
            advancePasses(ENV_PASSES);
            assertEquals<u8>(ch4().GetCurrentEnvelopeVolume(), 2,
                "vol should be 2 after first increase step");
        });

        it("pace=0 (NR42=0xF0): volume stays frozen at initial after many passes", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0xF0, 0, false); // vol=15, pace=0
            advancePasses(20);
            assertEquals<u8>(ch4().GetCurrentEnvelopeVolume(), 15,
                "vol frozen at 15 with pace=0");
        });
    });
}

// ─── Length Counter ───────────────────────────────────────────────────────────

function testLengthCounter(): void {
    // Pan Docs: CH4 length = (64 - NR41[5:0]) / 256 seconds (same as CH1/CH2).
    // samplesUntilStop = round((64 - lengthTimer) * 44100/256).
    //   NR41=63 → round(1 × 172.27) = 172 samples.
    //   NR41=60 → round(4 × 172.27) = 689 samples.
    describe("length counter", () => {
        it("NR41=63: channel disabled after 172 samples", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0xF0, 63, true);
            ch4().Render(0, BUF); // 128 samples; 172−128=44 remaining
            assert(ch4().Enabled, "channel still active after 128 samples (< 172)");
            ch4().Render(0, 44); // 128+44=172 ≥ 172 → stops
            assert(!ch4().Enabled, "channel should stop after 172 samples");
        });

        it("NR41=60: channel disabled after 689 samples", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0xF0, 60, true);
            advancePasses(5); // 640 < 689: still running
            assert(ch4().Enabled, "channel still enabled at 640 samples (< 689)");
            ch4().Render(0, 60); // 640+60=700 ≥ 689 → stops
            assert(!ch4().Enabled, "channel should stop after 700 samples (> 689)");
        });

        it("output is 0 after length counter stops channel", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0xF0, 63, true);
            ch4().Render(0, BUF);
            ch4().Render(0, 44); // channel stops here
            ch4().Render(0, BUF); // now disabled
            assertEquals<i32>(countNonzero(BUF), 0,
                "no nonzero samples when channel stopped by length counter");
        });

        it("length counter disabled: channel plays indefinitely (NR44 bit6=0)", () => {
            initAudio();
            triggerCH4(makeNR43(2, false, 1), 0xF0, 63, false); // lenEn=false
            advancePasses(10); // 1280 >> 172
            assert(ch4().Enabled,
                "channel should remain enabled when length counter is off");
        });
    });
}

// ─── Shift ≥14: LFSR Not Clocked ─────────────────────────────────────────────

function testLfsrShift14NotClocked(): void {
    // Pan Docs NR43: "Shift ≥ 14 → LFSR not clocked."
    // At shift=14, div=1 with correct impl: no LFSR ticks ever. Current impl may tick at
    // 262144/16 = 16384 Hz (2756 samples/tick) — this test exposes that gap if present.
    // At shift=13, div=1: 262144/32 = 8192 Hz → ~1378 samples/tick → visible in 3072 samples.
    describe("NR43 shift≥14: LFSR not clocked (Pan Docs obscure)", () => {
        it("shift=14: LFSR stays at 0 after 3072 samples (never clocked per spec)", () => {
            initAudio();
            triggerCH4(makeNR43(14, false, 1), 0xF0, 0, false);
            assertEquals<u16>(ch4().Lsfr, 0, "LFSR=0 after trigger");
            for (let i = 0; i < 24; i++) ch4().Render(0, BUF); // 24×128=3072 samples
            assertEquals<u16>(ch4().Lsfr, 0,
                "LFSR must not advance with shift=14 (LFSR not clocked per spec)");
        });

        it("shift=15: LFSR stays at 0 after 3072 samples (never clocked per spec)", () => {
            initAudio();
            triggerCH4(makeNR43(15, false, 1), 0xF0, 0, false);
            for (let i = 0; i < 24; i++) ch4().Render(0, BUF);
            assertEquals<u16>(ch4().Lsfr, 0,
                "LFSR must not advance with shift=15 (LFSR not clocked per spec)");
        });

        it("shift=13 does tick within 3072 samples (contrast: confirms threshold at 14)", () => {
            // shift=13, div=1: 262144/32 = 8192 Hz → ~1378 samples/tick → 2 ticks in 3072
            initAudio();
            triggerCH4(makeNR43(13, false, 1), 0xF0, 0, false);
            for (let i = 0; i < 24; i++) ch4().Render(0, BUF);
            assert(ch4().Lsfr != 0,
                `shift=13 LFSR should have advanced from 0 after 3072 samples (got ${ch4().Lsfr})`);
        });
    });
}

// ─── LFSR 7-bit Lockup ────────────────────────────────────────────────────────

function testLfsr7BitLockup(): void {
    // Pan Docs NR43: "7-bit mode lockup: switching to 7-bit when bottom 7 bits all 1
    // → LFSR locked → constant output until retrigger."
    // Proof: in 7-bit mode, XNOR(bit0=1, bit1=1)=1 → bit15=bit7=1 set, shift right →
    // bits 0-6 remain all 1. Pattern locks — bit0 always 1 → constant volume output.
    describe("LFSR 7-bit lockup: bits 0-6 all 1 → pattern locks", () => {
        it("bits 0-6 remain all 1 after ticks when in 7-bit mode (lockup)", () => {
            initAudio();
            triggerCH4(makeNR43(0, true, 1), 0xF0, 0, false); // 7-bit mode
            ch4().Lsfr = 0x007F; // manually set lower 7 bits all to 1
            ch4().TickLsfr(); // XNOR(1,1)=1 → bit15=1, bit7=1, shift right → 0x407F
            assertEquals<u16>(ch4().Lsfr & 0x7F, 0x7F,
                "bits 0-6 must stay all 1 after 1 tick (locked pattern)");
            ch4().TickLsfr();
            ch4().TickLsfr();
            ch4().TickLsfr();
            assertEquals<u16>(ch4().Lsfr & 0x7F, 0x7F,
                "bits 0-6 still all 1 after 4 total ticks (locked)");
        });

        it("15-bit mode with same bits does NOT lock (bits 0-6 diverge)", () => {
            // In 15-bit mode, bit7 feedback is absent, so pattern escapes
            initAudio();
            triggerCH4(makeNR43(0, false, 1), 0xF0, 0, false); // 15-bit mode
            ch4().Lsfr = 0x007F;
            for (let i = 0; i < 20; i++) ch4().TickLsfr();
            assert((ch4().Lsfr & 0x7F) != 0x7F,
                "15-bit mode should not lock: bits 0-6 should diverge from all-1 after 20 ticks");
        });

        it("retrigger resets LFSR to 0, breaking 7-bit lockup", () => {
            initAudio();
            triggerCH4(makeNR43(0, true, 1), 0xF0, 0, false);
            ch4().Lsfr = 0x007F;
            for (let i = 0; i < 10; i++) ch4().TickLsfr();
            assert((ch4().Lsfr & 0x7F) == 0x7F, "LFSR locked before retrigger");
            triggerCH4(makeNR43(0, true, 1), 0xF0, 0, false); // retrigger → Reset() → Lsfr=0
            assertEquals<u16>(ch4().Lsfr, 0, "LFSR reset to 0 by retrigger, lockup broken");
        });
    });
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export function testNoiseChannel(): boolean {
    testLfsrReset();
    testLfsr15BitSequence();
    testLfsr7BitShortMode();
    testClockDivider0();
    testClockShift();
    testEnvelope();
    testLengthCounter();
    testLfsrShift14NotClocked();
    testLfsr7BitLockup();
    return true;
}
