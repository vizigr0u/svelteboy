import { derived, get, writable } from "svelte/store";
import {
    getAudioSampleRate,
    getAudioBuffersSize,
    setMuteChannel,
    audioSab,
    AUDIO_SAB_CAPACITY,
} from "./wasmBridge";
import {
    AudioAnalyzerNode,
    AudioBufferSize,
    MuteSoundChannel1,
    MuteSoundChannel2,
    MuteSoundChannel3,
    MuteSoundChannel4,
} from "stores/debugStores";
import { AudioMasterVolume, EmulatorSpeed, HoldSpaceForSpeed, MuteOnFastForward } from "stores/optionsStore";
import { FastForwardActive } from "stores/playStores";
import { SabWriter } from "../audio/sabRingBuffer";

const FastForwardMute = derived(
    [MuteOnFastForward, HoldSpaceForSpeed, FastForwardActive, EmulatorSpeed],
    ([mute, hold, active, speed]) => mute && (hold ? active : speed !== 1)
);

export const AudioSuspended = writable<boolean>(false);
export const AudioWorkletActive = writable<boolean>(false);
export const AudioUnderrunStats = writable<{ underruns: number; frames: number }>({ underruns: 0, frames: 0 });

const FADE_OUT_S = 0.02;
const RESUME_FADE_S = 0.02;
const GAIN_RAMP_S = 0.01;

const WORKLET_MODULE_URL = '/gameboy-audio-processor.js';
const WORKLET_PROCESSOR_NAME = 'svelteboy-audio-processor';

let wasInit = false;
let audioCtx: AudioContext;
let analyzerNode: AnalyserNode;
let masterVolumeNode: GainNode;
let destinationNode: AudioNode;

let workletNode: AudioWorkletNode | null = null;
let sabWriter: SabWriter | null = null;

let audioFadedOut = false;
let pendingSuspendTimeout: ReturnType<typeof setTimeout> | null = null;

function isWorkletSupported(): boolean {
    return typeof SharedArrayBuffer === 'function'
        && typeof (globalThis as any).crossOriginIsolated !== 'undefined'
        && (globalThis as any).crossOriginIsolated === true
        && typeof AudioWorkletNode !== 'undefined';
}

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
    await audioCtx.audioWorklet.addModule(WORKLET_MODULE_URL);
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
    workletNode.port.postMessage({ type: 'init', sab: audioSab, capacity: AUDIO_SAB_CAPACITY });
    sabWriter = new SabWriter(audioSab, AUDIO_SAB_CAPACITY);
    workletNode.connect(destinationNode);
    AudioWorkletActive.set(true);
}

export const Audio = {
    Init: () => {
        if (wasInit) return;
        if (!isWorkletSupported()) {
            console.warn('[audio] AudioWorklet path unavailable (need crossOriginIsolated + SharedArrayBuffer). No audio will play.');
            wasInit = true;
            return;
        }

        // Pin context to WASM APU rate so worklet streams 1:1 without resampling drift.
        const wasmRate = getAudioSampleRate();
        try {
            audioCtx = new window.AudioContext({ sampleRate: wasmRate });
        } catch (_) {
            audioCtx = new window.AudioContext();
        }
        masterVolumeNode = audioCtx.createGain();
        analyzerNode = audioCtx.createAnalyser();
        analyzerNode.connect(masterVolumeNode);
        AudioAnalyzerNode.set(analyzerNode);
        masterVolumeNode.connect(audioCtx.destination);
        masterVolumeNode.gain.value = computeTargetGain();
        AudioMasterVolume.subscribe(() => applyTargetGain());
        FastForwardMute.subscribe(() => applyTargetGain());
        MuteSoundChannel1.subscribe(setMute => { setMuteChannel(1, setMute); });
        MuteSoundChannel2.subscribe(setMute => { setMuteChannel(2, setMute); });
        MuteSoundChannel3.subscribe(setMute => { setMuteChannel(3, setMute); });
        MuteSoundChannel4.subscribe(setMute => { setMuteChannel(4, setMute); });

        destinationNode = analyzerNode;
        AudioBufferSize.set(getAudioBuffersSize());

        const updateSuspended = () => AudioSuspended.set(audioCtx.state === 'suspended');
        audioCtx.addEventListener('statechange', updateSuspended);
        updateSuspended();

        const resumeOnGesture = () => { audioCtx?.resume(); };
        document.addEventListener('click', resumeOnGesture);
        document.addEventListener('keydown', resumeOnGesture);

        setupWorklet().catch(err => {
            console.error('[audio] Worklet setup failed:', err);
            workletNode = null;
            sabWriter = null;
            AudioWorkletActive.set(false);
        });

        wasInit = true;
    }
};

export function stopQueuedAudio(): void {
    if (!audioCtx) return;
    audioFadedOut = true;
    const now = audioCtx.currentTime;
    masterVolumeNode.gain.cancelScheduledValues(now);
    masterVolumeNode.gain.setValueAtTime(masterVolumeNode.gain.value, now);
    masterVolumeNode.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);

    // The worker still appends APU output to the SAB while we ramp down. Drop
    // it after the fade so we don't resume on stale samples.
    setTimeout(() => {
        sabWriter?.reset();
        workletNode?.port.postMessage({ type: 'reset' });
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
