The Core Problem
Your current approach has two compounding issues:

Unclamped dt — emulator.ts:277: if the browser pauses the tab, dt can be many seconds, causing the backend to try to generate seconds of emulation in one shot
Unbounded audio queue — emulator.ts:182-195: all available WASM buffers get scheduled as AudioBufferSourceNodes unconditionally, so after a pause you can schedule 10+ seconds of audio ahead, and currentPlayTime drifts far into the future
Common Strategies (from best to simplest)
1. Audio-as-Master-Clock (gold standard)
Make the audio consumption rate drive emulation speed rather than the display clock. The emulator only runs as fast as audio is being consumed.

Web version: measure lookaheadMs = (currentPlayTime - audioCtx.currentTime) * 1000 each rAF tick. This is how much audio is buffered ahead of what's actually playing right now:

If lookaheadMs > ~200ms: skip emulation this frame (audio queue is full)
If lookaheadMs < ~50ms: run an extra frame (starving, catch up)
Otherwise: run normally
This is the most robust approach and self-corrects naturally.

2. Dynamic Rate Control (libretro/bsnes approach)
Keep video synced to vsync, but micro-adjust EmulatorSpeed (you already have this store!) by ±0.5% based on audio buffer fill. At 0.5% deviation, pitch change is completely inaudible. The formula:


speed = ((1 - 0.005) + 2 * fillLevel * 0.005) * baseSpeed
Where fillLevel = lookaheadMs / targetLookaheadMs. This is gentler than the binary skip/run approach.

3. Clamp dt (quick win, low impact)
Just add const safeDt = Math.min(dt, 33) at emulator.ts:277. Limits tab-restore spikes to at most 2 frames of catchup. Doesn't fix drift but prevents worst-case storms.

4. visibilitychange handler (quick win)
Wire your existing pauseEmulator/unPauseEmulator to the Page Visibility API. The current code only triggers on user interaction, not on tab switch:


document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseEmulator();
    else audioCtx.resume().then(unPauseEmulator);
});
5. AudioWorklet + SharedArrayBuffer (biggest win, most work)
The real fix for browser-throttled audio: move the audio consumer to an AudioWorkletProcessor running on a dedicated real-time thread. It pulls from a SharedArrayBuffer ring buffer that your WASM fills. The worklet runs at real-time priority and is immune to main-thread GC/layout stalls.

Your WASM already has a ring buffer in assembly/audio/audioBuffer.ts — the backend work is mostly exposing the buffer memory as a SharedArrayBuffer. The frontend side creates a worklet that reads from it.

Constraint: requires Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy headers, which may affect GitHub Pages hosting.

What I'd Recommend for Your Specific Code
The highest leverage with lowest risk, in order:

Priority	Change	File	Lines
1	Clamp dt to 33ms	emulator.ts	L277
2	Audio lookahead gate: skip frame if currentPlayTime - audioCtx.currentTime > 0.2s, run extra if < 0.05s	emulator.ts	L276–290
3	Cap buffers drained per frame in postRunAudio (e.g. max 4 at once)	emulator.ts	L182–195
4	visibilitychange handler	emulator.ts	new
5	Dynamic Rate Control via EmulatorSpeed adjustment	emulator.ts	new
6	AudioWorklet migration	new files	big refactor
Items 1–4 are low-risk, mostly additive changes that directly address your desync problem. Items 5–6 are progressive improvements.

Want me to implement any of these? I'd suggest starting with the audio lookahead gate + dt clamp as they directly target the root cause.