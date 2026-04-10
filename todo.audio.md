## Missing / Broken Audio Features

1. CH1 Frequency Sweep — Completely Unimplemented
render.ts:181 has a // TODO. Per spec (NR10):

Shadow register (holds current period for sweep calculations)
Sweep timer + enabled flag, both initialized on trigger
Per 128 Hz DIV-APU tick: calc new period, overflow check, write back if ≤ 2047 and step ≠ 0, then do a second overflow check
Overflow disables CH1 even if pace = 0 (as long as individual step ≠ 0) — this means triggering a note with step > 0 can immediately kill CH1
Clearing direction bit (NR10 bit 3) after a subtracting sweep iteration immediately disables CH1

3. Length Timer Formula — Likely Wrong
AudioChannelBase.ts:30:

samplesUntilStop = LengthTimer * 72.26562
Spec: internal steps = (64 - rawValue), clocked at 256 Hz. Correct formula: (64 - LengthTimer) * SAMPLE_RATE / 256 ≈ (64 - LengthTimer) * 172.27. When LengthTimer = 0, the channel should run for the full 64 steps (0.25s), but current code gives 0 → never stops.

CH3 uses 8-bit timer with max 256, same bug.

4. DACs Not Tracked
No DAC enabled/disabled state per channel
DAC for CH1/CH2/CH4: enabled iff NRx2 & 0xF8 != 0 — if DAC off, channel must be force-disabled and retrigger is ineffective
CH3 DAC controlled by NR30 bit 7 independently of channel enabled state
Currently render.ts:217 (NR30_C3Enable) directly sets enabled, which conflates DAC and channel active state

5. High-Pass Filter — Not Implemented
The output is missing the HPF that removes DC offset. Per spec (Audio_details.md):


out = in - capacitor;
capacitor = in - out * 0.996; // at 44100 Hz
Without this, there are DC offset pops on DAC enable/disable and volume changes.

6. Mixer Normalization — Wrong
render.ts:161:


left[i] *= l / numChans;
Dividing by active channel count is not spec behavior. The correct model: sum all enabled channels panned to L/R (each ±1 analog), multiply by NR50 volume factor (vol + 1) / 8. No per-channel normalization.

7. Envelope Period 0 Treated as Disabled — Wrong
AudioChannelBase.ts:26:


get EnvelopeEnabled(): boolean { return this.SweepPace != 0; }
Per spec: "The volume envelope and sweep timers treat a period of 0 as 8." Period 0 should still run the envelope timer with pace=8, not disable it.

8. LFSR Clock Shift 14/15 — Not Handled
NoiseChannel.ts:28: shift values 14 or 15 should stop CH4 from receiving any clocks (silence it). Currently the formula produces a very small but non-zero period instead.

9. NR52 Channel Status Bits — Read-Only Bits Not Updated
NR52 bits 0–3 are supposed to reflect live channel on/off status. Currently these are never updated from channel state, so games reading NR52 to poll channel state will malfunction.

10. APU Power-Off Register Clear — Not Implemented
Writing 0 to NR52 bit 7 should reset all NR10–NR51 registers to 0 and make them read-only until powered back on. Currently it only stops rendering. (Wave RAM and length timers on DMG are exempt.)

11. Period Change Delay — Not Implemented
Pulse (NR13/NR14): period takes effect only after current sample ends
Wave (NR33/NR34): takes effect after the next wave RAM read
Currently both apply immediately in the period setters
12. CH3 Last-Sample Buffer — Not Implemented
WaveChannel.ts:48: On trigger, CH3 should continue emitting the last sample in its buffer until the channel next reads from wave RAM. Retrigger does not clear or refresh the buffer. Currently not modeled.

13. Envelope Trigger Timing Edge Case
If a channel is triggered when the DIV-APU is about to clock the envelope, the envelope timer should be loaded with one more than normal. This is a timing obscurity but relevant for accuracy.

14. Extra Length Timer Clocking on NRx4 Write
Writing NRx4 with length enable going from off→on, when the next DIV-APU step won't clock the length timer and the counter is non-zero, should cause an immediate extra decrement. Not implemented.

Summary by Priority
#	Issue	Impact
1	CH1 sweep entirely missing	Many games (Mario, Zelda) use pitch sweeps
6	Mixer wrong	All output volume balance is off
2	No retrigger	Notes that restart same channel break
3	Length timer formula	Notes cut at wrong times
4	DACs not tracked	Spurious channel enables/disables
8	LFSR shift 14/15	Noise channel doesn't silence correctly
5	No HPF	Audio pops on every DAC/volume change
7	Envelope period 0	Fast envelope decay broken
9	NR52 status bits	Games that poll channel state break
10	APU power-off	APU reset sequence incorrect
11	Period delay	Very slight pitch timing inaccuracy
12	CH3 last-sample	CH3 retrigger has brief wrong output
13–14	Obscure DIV-APU edge cases	Rarely noticeable
