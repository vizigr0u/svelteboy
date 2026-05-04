import { derived, get, writable } from "svelte/store";
import {
    getAudioSampleRate,
    getAudioBuffersSize,
    getAudioBuffersToReadCount,
    getAudioBufferToReadPointer,
    markAudioBuffersRead,
    setMuteChannel,
    setAudioSpeedDivisor,
    getAudioBufferView,
} from "./wasmBridge";
import {
    AudioAnalyzerNode,
    AudioBufferPointers,
    AudioBufferSize,
    MuteSoundChannel1,
    MuteSoundChannel2,
    MuteSoundChannel3,
    MuteSoundChannel4,
} from "stores/debugStores";
import { AudioMasterVolume, AudioResampleMode, BurstSpeed, MuteOnFastForward, RegularSpeed } from "stores/optionsStore";
import { FastForwardActive } from "stores/playStores";
import { addPostRunCallback } from "./loop";
import { SabRing, SabWriter } from "../audio/sabRingBuffer";
import { probeAudioCapability, type AudioCapability } from "../audio/capabilities";

const FastForwardMute = derived(
    [MuteOnFastForward, FastForwardActive],
    ([mute, active]) => mute && active
);

export type AudioModeValue = 'pending' | 'worklet' | 'fallback' | 'none';

export const AudioSuspended = writable<boolean>(false);
export const AudioWorkletActive = writable<boolean>(false);
export const AudioMode = writable<AudioModeValue>('pending');
export const AudioUnderrunStats = writable<{ underruns: number; frames: number }>({ underruns: 0, frames: 0 });

const FADE_OUT_S = 0.02;
const RESUME_FADE_S = 0.02;
const GAIN_RAMP_S = 0.01;

// Stereo frames in the SAB ring. 16384 @ 44.1 kHz ≈ 371 ms — large enough to absorb stalls.
const SAB_CAPACITY_FRAMES = 16384;
// Target SAB occupancy. Catch-up bursts above this are dropped at the WASM ring, not the SAB,
// so the worklet always plays at wall-clock pace instead of skipping forward.
const SAB_TARGET_FRAMES = 4096; // ~93 ms

// Fallback path: max seconds of audio we'll queue ahead of currentTime before dropping buffers.
// Keeps fallback latency bounded and avoids unbounded source-node growth.
const FALLBACK_MAX_AHEAD_S = 0.2;

const WORKLET_PROCESSOR_NAME = 'svelteboy-audio-processor';

function getWorkletModuleUrl(): string {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    return new URL('gameboy-audio-processor.js', new URL(base, window.location.origin)).toString();
}

let wasInit = false;
let audioCtx: AudioContext;
let analyzerNode: AnalyserNode;
let masterVolumeNode: GainNode;
let destinationNode: AudioNode;

let workletNode: AudioWorkletNode | null = null;
let sabWriter: SabWriter | null = null;

let fallbackScheduledTime = 0;

let audioFadedOut = false;
let pendingSuspendTimeout: ReturnType<typeof setTimeout> | null = null;

let wasmRate = 44100;
let outRate = 44100;
let resamplePhase = 0;
let resamplePrevL = 0;
let resamplePrevR = 0;
let lastAppliedDivisor = 1;

function computeTargetGain(): number {
    if (get(FastForwardMute)) return 0;
    const v = get(AudioMasterVolume);
    return v * v;
}

function applyTargetGain(): void {
    if (!audioCtx || audioFadedOut) return;
    const target = computeTargetGain();
    const now = audioCtx.currentTime;
    masterVolumeNode.gain.cancelScheduledValues(now);
    masterVolumeNode.gain.setValueAtTime(masterVolumeNode.gain.value, now);
    masterVolumeNode.gain.linearRampToValueAtTime(target, now + GAIN_RAMP_S);
}

async function setupWorklet(): Promise<void> {
    await audioCtx.audioWorklet.addModule(getWorkletModuleUrl());
    const sab = SabRing.allocate(SAB_CAPACITY_FRAMES);
    workletNode = new AudioWorkletNode(audioCtx, WORKLET_PROCESSOR_NAME, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
    });
    workletNode.port.onmessage = (e) => {
        const data = e.data;
        if (data && data.type === 'stats') {
            AudioUnderrunStats.set({ underruns: data.underruns, frames: data.underrunFrames });
        }
    };
    workletNode.port.postMessage({ type: 'init', sab, capacity: SAB_CAPACITY_FRAMES });
    sabWriter = new SabWriter(sab, SAB_CAPACITY_FRAMES);
    workletNode.connect(destinationNode);
    AudioWorkletActive.set(true);
    addPostRunCallback(postRunAudioWorklet);
}

function setupFallback(): void {
    fallbackScheduledTime = 0;
    addPostRunCallback(postRunAudioFallback);
}

function setupNoAudio(): void {
    addPostRunCallback(postRunDrainOnly);
}

export const Audio = {
    Init: () => {
        if (wasInit) return;
        wasInit = true;

        const cap: AudioCapability = probeAudioCapability();
        if (cap === 'none') {
            console.warn('[audio] No AudioContext available — audio disabled.');
            AudioMode.set('none');
            // Still wire the post-run drain so the WASM ring doesn't fill up.
            wasmRate = getAudioSampleRate();
            outRate = wasmRate;
            setupNoAudio();
            return;
        }

        // Try to pin context to WASM APU rate; browser may fall back to OS default (often 48 kHz).
        wasmRate = getAudioSampleRate();
        try {
            audioCtx = new window.AudioContext({ sampleRate: wasmRate });
        } catch (_) {
            audioCtx = new window.AudioContext();
        }
        outRate = audioCtx.sampleRate;
        masterVolumeNode = audioCtx.createGain();
        analyzerNode = audioCtx.createAnalyser();
        analyzerNode.connect(masterVolumeNode);
        AudioAnalyzerNode.set(analyzerNode);
        masterVolumeNode.connect(audioCtx.destination);
        masterVolumeNode.gain.value = computeTargetGain();
        AudioMasterVolume.subscribe(() => applyTargetGain());
        FastForwardMute.subscribe(() => applyTargetGain());
        AudioResampleMode.subscribe(() => onResampleParamsChanged());
        FastForwardActive.subscribe(() => onResampleParamsChanged());
        BurstSpeed.subscribe(() => onResampleParamsChanged());
        RegularSpeed.subscribe(() => onResampleParamsChanged());
        MuteSoundChannel1.subscribe(setMute => { setMuteChannel(1, setMute); });
        MuteSoundChannel2.subscribe(setMute => { setMuteChannel(2, setMute); });
        MuteSoundChannel3.subscribe(setMute => { setMuteChannel(3, setMute); });
        MuteSoundChannel4.subscribe(setMute => { setMuteChannel(4, setMute); });

        destinationNode = analyzerNode;

        const updateSuspended = () => AudioSuspended.set(audioCtx.state === 'suspended');
        audioCtx.addEventListener('statechange', updateSuspended);
        updateSuspended();

        const resumeOnGesture = () => { audioCtx?.resume(); };
        document.addEventListener('click', resumeOnGesture);
        document.addEventListener('keydown', resumeOnGesture);
        document.addEventListener('pointerdown', resumeOnGesture);

        if (cap === 'worklet') {
            setupWorklet().then(() => {
                AudioMode.set('worklet');
            }).catch(err => {
                console.warn('[audio] Worklet setup failed, falling back to AudioBufferSourceNode:', err);
                workletNode = null;
                sabWriter = null;
                AudioWorkletActive.set(false);
                setupFallback();
                AudioMode.set('fallback');
            });
        } else {
            console.warn('[audio] crossOriginIsolated/SAB unavailable — using AudioBufferSourceNode fallback (higher latency, may stutter under main-thread load).');
            setupFallback();
            AudioMode.set('fallback');
        }

        onResampleParamsChanged();
    }
};

function getEffectiveSpeed(): number {
    const raw = get(FastForwardActive) ? get(BurstSpeed) : get(RegularSpeed);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

// Mode 'apu': APU emits at outRate × (1/speed) wall-time samples — divisor handles all rate
// matching, JS does identity copy.
// Mode 'js' : APU emits at fixed wasmRate; JS resamples to outRate with step = wasmRate*speed/outRate.
function onResampleParamsChanged(): void {
    if (!wasInit) return;
    const mode = get(AudioResampleMode);
    const speed = getEffectiveSpeed();
    const divisor = mode === 'apu' ? (wasmRate / outRate) * speed : 1;
    if (divisor !== lastAppliedDivisor) {
        setAudioSpeedDivisor(divisor);
        lastAppliedDivisor = divisor;
    }
}

// Linear-interpolation resampler with phase preserved across calls. step in input-samples per
// output-sample. Identity when step === 1.
function resampleStereo(left: Float32Array, right: Float32Array, step: number): { L: Float32Array, R: Float32Array } {
    const inLen = left.length;
    const maxOut = Math.max(0, Math.ceil((inLen - resamplePhase) / step) + 1);
    const outL = new Float32Array(maxOut);
    const outR = new Float32Array(maxOut);
    let pos = resamplePhase;
    let n = 0;
    while (pos < inLen) {
        const i = Math.floor(pos);
        const t = pos - i;
        const l0 = i <= 0 ? resamplePrevL : left[i - 1];
        const r0 = i <= 0 ? resamplePrevR : right[i - 1];
        const l1 = left[i];
        const r1 = right[i];
        outL[n] = l0 * (1 - t) + l1 * t;
        outR[n] = r0 * (1 - t) + r1 * t;
        n++;
        pos += step;
    }
    resamplePhase = pos - inLen;
    resamplePrevL = left[inLen - 1];
    resamplePrevR = right[inLen - 1];
    return { L: outL.subarray(0, n), R: outR.subarray(0, n) };
}

function postRunDrainOnly(): void {
    const numAvailableBuffers = getAudioBuffersToReadCount();
    if (numAvailableBuffers > 0) markAudioBuffersRead(numAvailableBuffers);
}

function postRunAudioWorklet(): void {
    const bufferSize = getAudioBuffersSize();
    AudioBufferSize.set(bufferSize);
    const numAvailableBuffers = getAudioBuffersToReadCount();

    // No worklet yet (still loading) or context not running: drain WASM ring to keep backend live.
    if (!sabWriter || audioCtx.state !== 'running') {
        if (numAvailableBuffers > 0) markAudioBuffersRead(numAvailableBuffers);
        return;
    }

    if (numAvailableBuffers === 0) return;

    const mode = get(AudioResampleMode);
    const speed = getEffectiveSpeed();
    const step = mode === 'apu' ? 1 : (wasmRate * speed) / outRate;

    let buffersToWrite: number;
    if (step >= 1.0) {
        buffersToWrite = numAvailableBuffers;
    } else {
        const occupancy = sabWriter.availableRead();
        const headroom = Math.max(0, SAB_TARGET_FRAMES - occupancy);
        const outPerInput = Math.max(1, Math.ceil(bufferSize / step));
        buffersToWrite = Math.min(numAvailableBuffers, Math.max(1, Math.ceil(headroom / outPerInput)));
        const toDrain = numAvailableBuffers - buffersToWrite;
        if (toDrain > 0) markAudioBuffersRead(toDrain);
    }

    if (buffersToWrite === 0) return;
    const ptrs: number[][] = [];
    for (let i = 0; i < buffersToWrite; i++) {
        const leftPtr = getAudioBufferToReadPointer(0);
        const rightPtr = getAudioBufferToReadPointer(1);
        ptrs.push([leftPtr, rightPtr]);
        const left = getAudioBufferView(leftPtr, bufferSize);
        const right = getAudioBufferView(rightPtr, bufferSize);
        if (step === 1) {
            sabWriter.write(left, right);
        } else {
            const { L, R } = resampleStereo(left, right, step);
            if (L.length > 0) sabWriter.write(L, R);
        }
        markAudioBuffersRead(1);
    }
    AudioBufferPointers.set(ptrs);
}

function postRunAudioFallback(): void {
    const bufferSize = getAudioBuffersSize();
    AudioBufferSize.set(bufferSize);
    const numAvailableBuffers = getAudioBuffersToReadCount();
    if (numAvailableBuffers === 0) return;

    if (audioCtx.state !== 'running') {
        markAudioBuffersRead(numAvailableBuffers);
        return;
    }

    const now = audioCtx.currentTime;
    if (fallbackScheduledTime < now) fallbackScheduledTime = now;

    const mode = get(AudioResampleMode);
    const speed = getEffectiveSpeed();
    const step = mode === 'apu' ? 1 : (wasmRate * speed) / outRate;

    const ptrs: number[][] = [];
    for (let i = 0; i < numAvailableBuffers; i++) {
        // Drop if too far ahead — keeps fallback latency bounded.
        if (fallbackScheduledTime - now > FALLBACK_MAX_AHEAD_S) {
            const remaining = numAvailableBuffers - i;
            markAudioBuffersRead(remaining);
            break;
        }
        const leftPtr = getAudioBufferToReadPointer(0);
        const rightPtr = getAudioBufferToReadPointer(1);
        ptrs.push([leftPtr, rightPtr]);
        const left = getAudioBufferView(leftPtr, bufferSize);
        const right = getAudioBufferView(rightPtr, bufferSize);

        let outL: Float32Array;
        let outR: Float32Array;
        if (step === 1) {
            outL = new Float32Array(left);
            outR = new Float32Array(right);
        } else {
            const { L, R } = resampleStereo(left, right, step);
            outL = L;
            outR = R;
        }
        markAudioBuffersRead(1);

        if (outL.length === 0) continue;

        const buf = audioCtx.createBuffer(2, outL.length, outRate);
        buf.getChannelData(0).set(outL);
        buf.getChannelData(1).set(outR);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(destinationNode);
        src.start(fallbackScheduledTime);
        fallbackScheduledTime += outL.length / outRate;
    }
    AudioBufferPointers.set(ptrs);
}

export function stopQueuedAudio(): void {
    if (!audioCtx) return;
    audioFadedOut = true;
    const now = audioCtx.currentTime;
    masterVolumeNode.gain.cancelScheduledValues(now);
    masterVolumeNode.gain.setValueAtTime(masterVolumeNode.gain.value, now);
    masterVolumeNode.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);

    const pending = getAudioBuffersToReadCount();
    if (pending > 0) markAudioBuffersRead(pending);

    // Drain ring after gain reaches 0 to avoid resuming with stale samples.
    setTimeout(() => {
        sabWriter?.reset();
        workletNode?.port.postMessage({ type: 'reset' });
        fallbackScheduledTime = 0;
        resamplePhase = 0;
        resamplePrevL = 0;
        resamplePrevR = 0;
    }, FADE_OUT_S * 1000 + 5);
}

export function suspendAudio(): void {
    stopQueuedAudio();
    if (pendingSuspendTimeout != null) clearTimeout(pendingSuspendTimeout);
    pendingSuspendTimeout = setTimeout(() => {
        pendingSuspendTimeout = null;
        audioCtx?.suspend();
    }, (FADE_OUT_S * 1000) + 10);
}

export function resumeAudio(): void {
    if (!audioCtx) return;
    if (pendingSuspendTimeout != null) {
        clearTimeout(pendingSuspendTimeout);
        pendingSuspendTimeout = null;
    }
    if (!audioFadedOut && audioCtx.state === 'running') return;
    audioFadedOut = false;
    audioCtx.resume().then(() => {
        if (!audioCtx) return;
        const target = computeTargetGain();
        const now = audioCtx.currentTime;
        const cur = masterVolumeNode.gain.value;
        masterVolumeNode.gain.cancelScheduledValues(now);
        masterVolumeNode.gain.setValueAtTime(cur, now);
        masterVolumeNode.gain.linearRampToValueAtTime(target, now + RESUME_FADE_S);
    });
}
