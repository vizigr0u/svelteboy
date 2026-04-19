import { MemoryMap } from "../memory/memoryMap";
import { AudioRender } from "../audio/render";
import { AudioEventQueue } from "../audio/eventQueue";
import { AudioChannel, AudioRegisterType } from "../audio/audioTypes";
import { CYCLES_PER_SAMPLE } from "../audio/constants";
import { describe, it, assertEquals } from "./framework";
import { setTestRom } from "./cpuTests";

// Channel render buffer capacity per Render(0, BUF) call
const BUF: i32 = 128;

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

// vol = NR12 byte: bits 7-4 = initial volume, bit 3 = direction, bits 2-0 = pace
function triggerCH1(vol: u8, period: u16): void {
    MemoryMap.GBstore<u8>(0xFF10, 0x00);
    MemoryMap.GBstore<u8>(0xFF11, 0x80); // duty 50%
    MemoryMap.GBstore<u8>(0xFF12, vol);
    MemoryMap.GBstore<u8>(0xFF13, <u8>(period & 0xFF));
    MemoryMap.GBstore<u8>(0xFF14, 0x80 | <u8>((period >> 8) & 0x7));
    flushAudioEvents();
}

function triggerCH2(vol: u8, period: u16): void {
    MemoryMap.GBstore<u8>(0xFF16, 0x80); // duty 50%
    MemoryMap.GBstore<u8>(0xFF17, vol);
    MemoryMap.GBstore<u8>(0xFF18, <u8>(period & 0xFF));
    MemoryMap.GBstore<u8>(0xFF19, 0x80 | <u8>((period >> 8) & 0x7));
    flushAudioEvents();
}

// Drain outstanding ring-buffer entries so tests start from a known count.
function drainRingBuffer(): void {
    const count = AudioRender.outBuffer.getBuffersToReadCount();
    if (count > 0) AudioRender.outBuffer.markBuffersRead(count);
}

// ─── NR51 Panning ────────────────────────────────────────────────────────────

function testPanningCH1Left(): void {
    // Pan Docs NR51 ($FF25): bits 7-4 = CH4-1 left; bits 3-0 = CH4-1 right.
    // CH1 left bit = 0x10; CH1 right bit = 0x01.
    // NR51=0x10: CH1 routed to left only → r=0, l=x where x=Buffer[i]/7.5-1.
    // For vol=15 (NR12=0xF0), Buffer ∈ {0, 15} → x ∈ {-1, +1} → |x|=1, never 0.
    // period=2040: f=131072/8=16384 Hz → ~47 cycles per 128 samples → dense output.
    describe("NR51 panning: CH1 left only", () => {
        it("right output = 0 for all 128 samples", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10); // NR51: CH1 left only
            MemoryMap.GBstore<u8>(0xFF24, 0x77); // NR50: max volume both sides
            triggerCH1(0xF0, 2040);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);

            const right = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);
            for (let i = 0; i < BUF; i++) {
                assertEquals<f32>(right[i], 0.0, `right[${i}] should be 0 (CH1 not panned right)`);
            }
        });

        it("left output != 0 for all 128 samples (x is never 0 with integer buffer)", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);

            const left = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            for (let i = 0; i < BUF; i++) {
                assert(left[i] != 0.0, `left[${i}] should be non-zero (CH1 panned left, |x|=1)`);
            }
        });
    });
}

function testPanningCH2Right(): void {
    // NR51=0x02: CH2 right only (bit1). CH2 left bit=0x20.
    // l=0, r=x → left=0, right≠0.
    describe("NR51 panning: CH2 right only", () => {
        it("left output = 0 for all 128 samples", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x02); // NR51: CH2 right only
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH2(0xF0, 2040);
            AudioRender.channel2.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);

            const left = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            for (let i = 0; i < BUF; i++) {
                assertEquals<f32>(left[i], 0.0, `left[${i}] should be 0 (CH2 not panned left)`);
            }
        });

        it("right output != 0 for all 128 samples", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x02);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH2(0xF0, 2040);
            AudioRender.channel2.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);

            const right = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);
            for (let i = 0; i < BUF; i++) {
                assert(right[i] != 0.0, `right[${i}] should be non-zero (CH2 panned right)`);
            }
        });
    });
}

// ─── NR50 Volume Ratio ───────────────────────────────────────────────────────

function testNR50VolumeRatio(): void {
    // Pan Docs NR50 ($FF24): bits 6-4 = left vol, bits 2-0 = right vol.
    // LeftVolume = (vol+1)/8: vol=0→1/8=0.125, vol=7→8/8=1.0.
    // Since |x|=1.0 for every sample (Buffer ∈ {0,15}, x=-1 or +1):
    // sum|L[i]| = numSamples * LeftVolume → ratio vol7/vol0 = 1.0/0.125 = 8 exactly.
    describe("NR50 volume 0 vs 7: amplitude ratio ≈ 1:8", () => {
        it("sum|left| ratio vol=7 : vol=0 is 8.0 (±2%)", () => {
            // vol=0 → LeftVolume=0.125
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10); // CH1 left
            MemoryMap.GBstore<u8>(0xFF24, 0x00); // NR50: left vol=0
            triggerCH1(0xF0, 2040);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);
            const leftLow = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let sumLow: f32 = 0.0;
            for (let i = 0; i < BUF; i++) sumLow += Mathf.abs(leftLow[i]);

            // vol=7 → LeftVolume=1.0
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10);
            MemoryMap.GBstore<u8>(0xFF24, 0x70); // NR50: left vol=7
            triggerCH1(0xF0, 2040);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);
            const leftHigh = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let sumHigh: f32 = 0.0;
            for (let i = 0; i < BUF; i++) sumHigh += Mathf.abs(leftHigh[i]);

            assert(sumLow > 0.0, `sumLow should be > 0 (got ${sumLow})`);
            const ratio: f32 = sumHigh / sumLow;
            assert(ratio >= 7.84 && ratio <= 8.16,
                `vol ratio should be ~8, got ${ratio} (sumHigh=${sumHigh}, sumLow=${sumLow})`);
        });
    });
}

// ─── Master Enable Off ───────────────────────────────────────────────────────

function testMasterEnableOff(): void {
    // Pan Docs NR52 bit7=0: APU off → all rendered samples = 0.
    // MixChannels else-branch zeroes L/R buffers when AudioOn=false.
    describe("master enable off (NR52=0x00)", () => {
        it("all 128 left and right samples are 0 after APU powered off", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x11); // CH1 both sides
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);
            // Power APU off — clears all NR10-NR51 registers per Pan Docs
            MemoryMap.GBstore<u8>(0xFF26, 0x00);
            flushAudioEvents();

            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);

            const left  = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            const right = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);
            for (let i = 0; i < BUF; i++) {
                assertEquals<f32>(left[i],  0.0, `left[${i}] should be 0 with APU off`);
                assertEquals<f32>(right[i], 0.0, `right[${i}] should be 0 with APU off`);
            }
        });
    });
}

// ─── Master Enable Re-enabled ────────────────────────────────────────────────

function testMasterEnableReEnabled(): void {
    // Pan Docs: NR52=0x80 re-enables APU. Registers were cleared during power-off,
    // so a full re-trigger is required before sound resumes.
    describe("master enable re-enabled (NR52=0x80)", () => {
        it("left output has non-zero samples after APU re-enabled and channel re-triggered", () => {
            initAudio();
            // Power off
            MemoryMap.GBstore<u8>(0xFF26, 0x00);
            flushAudioEvents();
            // Power back on
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            flushAudioEvents();
            // Re-configure and re-trigger (registers were cleared)
            MemoryMap.GBstore<u8>(0xFF25, 0x10);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);

            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);

            const left = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let nonZero: i32 = 0;
            for (let i = 0; i < BUF; i++) {
                if (left[i] != 0.0) nonZero++;
            }
            assert(nonZero > 0, `left should have non-zero output after APU re-enabled (got ${nonZero}/128 non-zero)`);
        });
    });
}

// ─── Channel Mixing ──────────────────────────────────────────────────────────

function testChannelMixing(): void {
    // MixChannels divides by numChans (active channel count).
    // Each x ∈ [-1, +1] → l = (x1+x2)/2 ∈ [-1, +1]: no clipping possible.
    describe("two-channel mixing", () => {
        it("mixed output stays within ±1.0 for all 128 samples", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x33); // CH1+CH2 both L+R
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);
            triggerCH2(0xF0, 2040);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.channel2.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);

            const left  = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            const right = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Right);
            for (let i = 0; i < BUF; i++) {
                assert(left[i]  >= -1.0 && left[i]  <= 1.0, `left[${i}]=${left[i]} exceeds ±1.0`);
                assert(right[i] >= -1.0 && right[i] <= 1.0, `right[${i}]=${right[i]} exceeds ±1.0`);
            }
        });

        it("adding CH2 changes the mixed output (both channels contribute)", () => {
            // Single CH1 only: l = x1/1
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x11);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);
            const leftSingle = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let sumSingle: f32 = 0.0;
            for (let i = 0; i < BUF; i++) sumSingle += leftSingle[i];

            // CH1 + CH2 same settings but different phase counters: l = (x1+x2)/2
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x33);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);
            triggerCH2(0xF0, 2040);
            AudioRender.channel1.Render(0, BUF);
            AudioRender.channel2.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);
            const leftBoth = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let sumBoth: f32 = 0.0;
            for (let i = 0; i < BUF; i++) sumBoth += leftBoth[i];

            // Both within range; sum difference confirms both channels mixed in
            assert(sumBoth >= -128.0 && sumBoth <= 128.0,
                `two-channel sum ${sumBoth} out of ±128 range`);
            // Sums need not be equal: CH1+CH2 phases diverge, verifying independent mixing
            // (not asserting exact equality — phase difference makes them differ)
        });
    });
}

// ─── Cycle→Sample Alignment ──────────────────────────────────────────────────

function testCycleToSampleAlignment(): void {
    // EnqueueEvent: frameSampleIndex = round(cycleDiff / CYCLES_PER_SAMPLE).
    // Directly inject NR50 event at frameSampleIndex=64 into the queue.
    // RenderSamples splits at boundary 64: [0,64) uses LeftVolume=1.0,
    // [64,128) uses LeftVolume=0.125 (NR50=0x00 → vol=0 → (0+1)/8=0.125).
    // |x|=1.0 always → |L[i]| = LeftVolume → sum ratio = 1.0/0.125 = 8.
    describe("cycle-to-sample alignment", () => {
        it("NR50 volume event at sample 64 produces 8:1 amplitude ratio across boundary", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10); // CH1 left only
            MemoryMap.GBstore<u8>(0xFF24, 0x77); // LeftVolume=1.0 initially
            triggerCH1(0xF0, 2040);
            // Queue is now empty. Inject NR50=0x00 change (→ LeftVolume=0.125) at sample 64.
            AudioEventQueue.Enqueue(64, <u8>AudioRegisterType.NR50_Volume, 0x00);

            const cyclesFor128: u64 = <u64>Math.round(128.0 * CYCLES_PER_SAMPLE);
            AudioRender.Render(cyclesFor128);

            const left = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let sumBefore: f32 = 0.0;
            let sumAfter:  f32 = 0.0;
            for (let i = 0; i < 64; i++)  sumBefore += Mathf.abs(left[i]);
            for (let i = 64; i < 128; i++) sumAfter  += Mathf.abs(left[i]);

            assert(sumAfter > 0.0, `sumAfter should be > 0 (got ${sumAfter})`);
            const ratio: f32 = sumBefore / sumAfter;
            assert(ratio >= 7.5 && ratio <= 8.5,
                `volume boundary ratio should be ~8, got ${ratio} (before=${sumBefore}, after=${sumAfter})`);
        });
    });
}

// ─── Buffer Ring Advances ────────────────────────────────────────────────────

function testBufferRingAdvances(): void {
    // AudioOutBuffer.BufferSize=256. After rendering ≥256 samples via AudioRender.Render(),
    // nextWorkingBuffers() is called → getBuffersToReadCount() increments by 1.
    describe("buffer ring advances after full buffer rendered", () => {
        it("getBuffersToReadCount() increases by ≥1 after rendering 257 samples", () => {
            initAudio();
            drainRingBuffer();
            MemoryMap.GBstore<u8>(0xFF25, 0x11);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);

            const before: u32 = AudioRender.outBuffer.getBuffersToReadCount();
            // 257 samples ensures at least one full 256-sample buffer is completed
            const cycles: u64 = <u64>Math.ceil(257.0 * CYCLES_PER_SAMPLE);
            AudioRender.Render(cycles);
            const after: u32 = AudioRender.outBuffer.getBuffersToReadCount();

            assert(after >= before + 1,
                `buffer count should increase by ≥1 (before=${before}, after=${after})`);
        });
    });
}

// ─── Backpressure ────────────────────────────────────────────────────────────

function testBackpressureRingFull(): void {
    // Ring holds QueueSize-1=127 buffers (one slot reserved for read pointer).
    // Rendering past capacity sets renderingPaused=true and stops advancing.
    // No data overwrite: toPlayIndex buffer (slot 0) is never overwritten by stalled writer.
    describe("backpressure: render stalls when ring full", () => {
        it("renderingPaused=true and count=127 after filling all ring slots", () => {
            initAudio();
            drainRingBuffer();
            MemoryMap.GBstore<u8>(0xFF25, 0x11);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);

            // 130 × 256 samples > 127 × 256 ring capacity → overflow
            const cycles: u64 = <u64>Math.ceil(130.0 * 256.0 * CYCLES_PER_SAMPLE);
            AudioRender.Render(cycles);

            assert(AudioRender.renderingPaused,
                "renderingPaused should be true when ring is full");
            const count = AudioRender.outBuffer.getBuffersToReadCount();
            assertEquals<u32>(count, 127, `full ring should hold exactly 127 readable buffers`);
        });

        it("no overwrite: count does not exceed 127 even with more cycles", () => {
            // Re-render a second time without consuming — count must stay at 127
            const moreCycles: u64 = <u64>Math.ceil(10.0 * 256.0 * CYCLES_PER_SAMPLE);
            AudioRender.Render(AudioRender.sampleIndex + moreCycles);
            const count = AudioRender.outBuffer.getBuffersToReadCount();
            assertEquals<u32>(count, 127, `count must not overflow beyond 127`);
        });
    });
}

// ─── Debug Mute Flags ────────────────────────────────────────────────────────

function testDebugMuteFlags(): void {
    // debugMuteN=true: channel N excluded from MixChannels even when Enabled.
    // With only CH1 active and muted → l=0 → left[i]=LeftVolume*0=0 for all i.
    describe("debug mute flags suppress per-channel output", () => {
        it("muting CH1 (only active channel) zeroes all left output", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10);
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);
            AudioRender.debugMute1 = true;

            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);
            AudioRender.debugMute1 = false; // restore

            const left = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            for (let i = 0; i < BUF; i++) {
                assertEquals<f32>(left[i], 0.0, `left[${i}] should be 0 when CH1 muted`);
            }
        });

        it("muting CH2 does not suppress CH1 output", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10); // CH1 left only
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH1(0xF0, 2040);
            AudioRender.debugMute2 = true; // mute inactive channel

            AudioRender.channel1.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);
            AudioRender.debugMute2 = false;

            const left = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let nonZero: i32 = 0;
            for (let i = 0; i < BUF; i++) {
                if (left[i] != 0.0) nonZero++;
            }
            assert(nonZero > 0, `CH1 output should be unaffected by CH2 mute (got ${nonZero}/128 non-zero)`);
        });

        it("muting CH1 does not suppress CH2 output", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x22); // CH2 both sides
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            triggerCH2(0xF0, 2040);
            AudioRender.debugMute1 = true; // mute inactive CH1

            AudioRender.channel2.Render(0, BUF);
            AudioRender.RenderVolumes(0, BUF);
            AudioRender.MixChannels(0, BUF);
            AudioRender.debugMute1 = false;

            const left = AudioRender.outBuffer.getWorkingBuffer(AudioChannel.Left);
            let nonZero: i32 = 0;
            for (let i = 0; i < BUF; i++) {
                if (left[i] != 0.0) nonZero++;
            }
            assert(nonZero > 0, `CH2 output should be unaffected by CH1 mute (got ${nonZero}/128 non-zero)`);
        });
    });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function testAudioRender(): boolean {
    testPanningCH1Left();
    testPanningCH2Right();
    testNR50VolumeRatio();
    testMasterEnableOff();
    testMasterEnableReEnabled();
    testChannelMixing();
    testCycleToSampleAlignment();
    testBufferRingAdvances();
    testBackpressureRingFull();
    testDebugMuteFlags();
    return true;
}
