import { derived, get, writable } from "svelte/store";
import {
    getAudioSampleRate,
    getAudioBuffersSize,
    getAudioBuffersToReadCount,
    getAudioBufferToReadPointer,
    markAudioBuffersRead,
    setMuteChannel,
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
import { AudioMasterVolume, EmulatorSpeed, HoldSpaceForSpeed, MuteOnFastForward } from "stores/optionsStore";
import { FastForwardActive } from "stores/playStores";
import { addPostRunCallback } from "./loop";
import { SabRing, SabWriter } from "../audio/sabRingBuffer";

const FastForwardMute = derived(
    [MuteOnFastForward, HoldSpaceForSpeed, FastForwardActive, EmulatorSpeed],
    ([mute, hold, active, speed]) => mute && (hold ? active : speed !== 1)
);

export const AudioSuspended = writable<boolean>(false);
export const AudioWorkletActive = writable<boolean>(false);
export const AudioUnderrunStats = writable<{ underruns: number; frames: number }>({ underruns: 0, frames: 0 });

const TARGET_LOOKAHEAD_S = 0.30; // legacy path: how far ahead to schedule
const FADE_OUT_S = 0.02;
const PREROLL_S = 0.05;
const RESUME_FADE_S = 0.02;
const GAIN_RAMP_S = 0.01;

// Worklet ring capacity in stereo frames. 16384 @ 44.1kHz ≈ 371 ms — large enough for big stalls.
const SAB_CAPACITY_FRAMES = 16384;
const WORKLET_MODULE_URL = '/gameboy-audio-processor.js';
const WORKLET_PROCESSOR_NAME = 'svelteboy-audio-processor';

let wasInit = false;
let audioCtx: AudioContext;
let analyzerNode: AnalyserNode;
let masterVolumeNode: GainNode;
let destinationNode: AudioNode;

// Worklet path
let workletNode: AudioWorkletNode | null = null;
let sabWriter: SabWriter | null = null;

// Legacy path
let currentPlayTime = -1;
const activeSourceNodes: AudioBufferSourceNode[] = [];
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
}

export const Audio = {
    Init: () => {
        if (wasInit) return;
        // Pin context to WASM APU rate so the worklet streams 1:1 without resampling drift.
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
        addPostRunCallback(postRunAudio);

        const updateSuspended = () => AudioSuspended.set(audioCtx.state === 'suspended');
        audioCtx.addEventListener('statechange', updateSuspended);
        updateSuspended();

        const resumeOnGesture = () => { audioCtx?.resume(); };
        document.addEventListener('click', resumeOnGesture);
        document.addEventListener('keydown', resumeOnGesture);

        if (isWorkletSupported()) {
            setupWorklet().catch(err => {
                console.warn('[audio] Worklet setup failed, falling back to legacy path:', err);
                workletNode = null;
                sabWriter = null;
                AudioWorkletActive.set(false);
            });
        }

        wasInit = true;
    }
};

function postRunAudio(): void {
    const bufferSize = getAudioBuffersSize();
    AudioBufferSize.set(bufferSize);
    const sampleRate = getAudioSampleRate();
    const numAvailableBuffers = getAudioBuffersToReadCount();

    if (audioCtx.state !== 'running') {
        if (numAvailableBuffers > 0) markAudioBuffersRead(numAvailableBuffers);
        return;
    }

    if (sabWriter) {
        postRunWorklet(bufferSize, numAvailableBuffers);
        return;
    }
    postRunLegacy(bufferSize, sampleRate, numAvailableBuffers);
}

function postRunWorklet(bufferSize: number, numAvailableBuffers: number): void {
    if (numAvailableBuffers === 0) return;
    const ptrs: number[][] = [];
    for (let i = 0; i < numAvailableBuffers; i++) {
        const leftPtr = getAudioBufferToReadPointer(0);
        const rightPtr = getAudioBufferToReadPointer(1);
        ptrs.push([leftPtr, rightPtr]);
        const left = getAudioBufferView(leftPtr, bufferSize);
        const right = getAudioBufferView(rightPtr, bufferSize);
        sabWriter!.write(left, right);
        markAudioBuffersRead(1);
    }
    AudioBufferPointers.set(ptrs);
}

function postRunLegacy(bufferSize: number, sampleRate: number, numAvailableBuffers: number): void {
    const bufferDuration = bufferSize / sampleRate;
    const lookahead = currentPlayTime - audioCtx.currentTime;
    const buffersToFillTarget = Math.ceil((TARGET_LOOKAHEAD_S - lookahead) / bufferDuration);
    const buffersToSchedule = Math.max(0, Math.min(numAvailableBuffers, buffersToFillTarget));

    const toDrain = numAvailableBuffers - buffersToSchedule;
    if (toDrain > 0) markAudioBuffersRead(toDrain);

    if (buffersToSchedule > 0) {
        const ptrs = [];
        for (let i = 0; i < buffersToSchedule; i++) {
            const leftPtr = getAudioBufferToReadPointer(0);
            const rightPtr = getAudioBufferToReadPointer(1);
            ptrs.push([leftPtr, rightPtr]);
            const buffer = createAudioBufferFromData(leftPtr, rightPtr, bufferSize, sampleRate);
            queueBuffer(buffer);
            markAudioBuffersRead(1);
        }
        AudioBufferPointers.set(ptrs);
    }
}

function createAudioBufferFromData(leftPtr: number, rightPtr: number, bufferSize: number, sampleRate: number): AudioBuffer {
    const audioBuffer = audioCtx.createBuffer(2, bufferSize, sampleRate);
    const left = getAudioBufferView(leftPtr, bufferSize);
    const right = getAudioBufferView(rightPtr, bufferSize);
    audioBuffer.copyToChannel(left, 0);
    audioBuffer.copyToChannel(right, 1);
    return audioBuffer;
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

    if (sabWriter) {
        // Drain ring after gain reaches 0 to avoid resuming with stale samples.
        setTimeout(() => {
            sabWriter?.reset();
            workletNode?.port.postMessage({ type: 'reset' });
        }, FADE_OUT_S * 1000 + 5);
        return;
    }

    const nodesToStop = activeSourceNodes.slice();
    activeSourceNodes.length = 0;
    currentPlayTime = -1;
    setTimeout(() => {
        for (const node of nodesToStop) {
            try { node.stop(); } catch (_) { }
        }
    }, FADE_OUT_S * 1000 + 5);
}

function queueBuffer(buffer: AudioBuffer): void {
    if (currentPlayTime < audioCtx.currentTime) {
        currentPlayTime = audioCtx.currentTime + PREROLL_S;
    }
    const source = playBuffer(buffer, currentPlayTime);
    activeSourceNodes.push(source);
    source.onended = () => {
        const i = activeSourceNodes.indexOf(source);
        if (i !== -1) activeSourceNodes.splice(i, 1);
    };
    currentPlayTime += buffer.duration;
}

function playBuffer(buffer: AudioBuffer, startTime: number): AudioBufferSourceNode {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(destinationNode);
    source.start(startTime);
    return source;
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
