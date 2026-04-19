---
name: audio
description: Prime context for working on the SvelteBoy APU — architecture, channel implementations, register layout, event queue, render pipeline, and test patterns
argument-hint: [optional: specific area, e.g. "pulse", "sweep", "envelope", "wave", "noise", "tests"]
---

Working on `assembly/audio/`. Read files directly for API; this skill captures non-obvious invariants and derived lookup data only.

## Non-Obvious Invariants

- **Channel buffer size = 128** (`AudioData.HalfBufferSize = AudioOutBuffer.BufferSize >> 1`). `Render(start, end)` indices are 0–127. To advance N samples call `Render(0, 128)` × ceil(N/128).
- **Phase NOT reset on trigger** — only `Reset()` (called by `AudioRender.Init()`) zeroes phase. Re-trigger restores envelope and re-enables; phase continues.
- **NR13/NR14 PeriodHigh write does NOT update `sweepShadowPeriod`** — shadow only updated by trigger and sweep ticks.
- **Envelope changes only visible at segment boundaries** (≤128 samples). `TickSamples` runs after each segment; `GetCurrentEnvelopeVolume()` is sampled once per segment start.
- **MixChannels formula**: `(nibble / 7.5) - 1.0` maps 0–15 → -1…+1; divided by active channel count.

## CH1 Sweep: Critical Order of Operations

On **trigger** (step≠0): immediate `sweepCalcNewPeriod()` overflow check before any tick. If result >2047 → `disable()`. This means high-period + large-step combos disable on trigger, not on first tick.

On **tick** (pace≠0):
1. `newPeriod = shadow ± (shadow >> step)`. Overflow → disable, return.
2. If step≠0: write back to shadow+frequencyBits, then **second overflow check on updated shadow** — can disable even when step 1 passed.

**Pace=0**: timer still runs (effectivePace=8 per obscure spec), but no frequency update on tick.

**Negate-then-clear**: clearing NR10 negate bit after subtract mode was used in current trigger cycle → immediate `disable()` (checked in `HandleSweepEvent`).

## Duty Cycle Lookup (PulseChannel)

Output: `phase >= waveHighRatio ? volume : 0`

| NR11[7:6] | enum | waveHighRatio | % high |
|-----------|------|---------------|--------|
| 00 | VeryHigh | 0.875 | 12.5% |
| 01 | High | 0.75 | 25% |
| 10 | Medium | 0.5 | 50% |
| 11 | Low | 0.25 | 75% |

Names are counterintuitive: "VeryHigh" = mostly LOW (only top 12.5% of phase is high).

## Timing Reference (at SAMPLE_RATE=44100)

| Event | Formula | Samples | Min passes (×128) |
|-------|---------|---------|-------------------|
| Sweep tick, pace=1 | ceil(44100/128) | 345 | 3 (384) |
| Envelope step, pace=1 | ceil(44100/64) | 690 | 6 (768) |
| Length stop, timer=63 | round(1×172.27) | 172 | Render(0,128)+Render(0,44) |
| Length stop, timer=60 | round(4×172.27) | 689 | 5 passes then Render(0,60) |
| Length stop, timer=0 | round(64×172.27) | 11025 | — |

CH3 length: `round((256 − timer) × 44100/256)`.

## Test Period Reference

| period | f (Hz) | samples/cycle | notes |
|--------|--------|--------------|-------|
| 2040 | 16384 | 2.69 | duty ratio counting (~47 cycles/128 samples) |
| 2000 | 2731 | 16.1 | edge counting; sweep-down source (NR10=0x1C, step=4: 2000→1875) |
| 1800 | 529 | 83.4 | sweep-up source (NR10=0x14, step=4: 1800→1912→second-check 2031 ✓) |
| 1024 | 128 | 344 | pace=0 sweep tests; step=1 trigger-safe (1024+512=1536≤2047) |
| 512 | 85 | 517 | simple trigger/length tests |

**Sweep safety with step=1 (add)**: trigger immediate check requires `period + period/2 ≤ 2047` → **period ≤ 1364**. Use step=4 for high-frequency sweep tests.

## Uint4Array — Channel Buffer Storage

`Buffer` in each channel is `Uint4Array`: two 4-bit samples packed per byte.

- `length` = `internal.length × 2` (128-sample buffer → 64 bytes internal)
- `get(i)`: byte = `i>>1`; shift = `(i%2)<<2` (0 for even, 4 for odd); return `(byte >> shift) & 0xF`
- `set(i, v)`: masks out target nibble, ORs in `v << shift`; asserts `v ≤ 0xF`
- `wrap(buffer, byteOffset, length)`: zero-copy view over existing `ArrayBuffer`; `length` is byte count, not nibble count → `Uint4Array.wrap` with 64 gives 128-element array

Non-obvious: even index → **low nibble** (bits 3:0); odd index → **high nibble** (bits 7:4). Order is little-nibble-first within each byte.

When reading `Buffer[i]` expect `u8` in range 0–15 (raw volume, not scaled). Scaling happens in `MixChannels` at render time.

## Test Setup Pattern

```typescript
// from assembly/tests/pulseChannelTests.ts and audioRegisterTests.ts
function initAudio(): void {
    setTestRom([0x00]);               // resets emulator + channel phases via AudioRender.Init()
    AudioRender.Prepare(0);           // resets event queue only
    MemoryMap.GBstore<u8>(0xFF26, 0x80); flushAudioEvents();
}
// Register writes require flushAudioEvents() to reach channels.
// Direct render: AudioRender.channel1.Render(0, 128)
// Check vol:     AudioRender.channel1.GetCurrentEnvelopeVolume()  (public)
// Check active:  AudioRender.channel1.Enabled  (getter)
// Buffer read:   AudioRender.channel1.Buffer[i]  → u8, 0 or volume (Uint4Array)
```

For existing test examples: `assembly/tests/pulseChannelTests.ts`, `assembly/tests/audioRegisterTests.ts`.
Pan Docs: use `gameboy-docs` skill → `Audio.md`, `Audio_details.md`, `Audio_Registers.md`.

$ARGUMENTS
