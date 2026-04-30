import { get, writable } from "svelte/store";
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
import { AudioMasterVolume } from "stores/optionsStore";
import { addPostRunCallback } from "./loop";

export const AudioSuspended = writable<boolean>(false);

const TARGET_LOOKAHEAD_S = 0.30; // num seconds to survive occasional long frames without audible latency
const FADE_OUT_S = 0.02;
const PREROLL_S = 0.05;
const RESUME_FADE_S = 0.02;

let wasInit = false;
let audioCtx: AudioContext;
let analyzerNode: AnalyserNode;
let masterVolumeNode: GainNode;
let destinationNode: AudioNode;

let currentPlayTime = -1;
const activeSourceNodes: AudioBufferSourceNode[] = [];
let audioFadedOut = false;
let pendingSuspendTimeout: ReturnType<typeof setTimeout> | null = null;

export const Audio = {
    Init: () => {
        if (wasInit) return;
        audioCtx = new window.AudioContext();
        masterVolumeNode = audioCtx.createGain();
        analyzerNode = audioCtx.createAnalyser();
        analyzerNode.connect(masterVolumeNode);
        AudioAnalyzerNode.set(analyzerNode);
        masterVolumeNode.connect(audioCtx.destination);
        masterVolumeNode.gain.value = get(AudioMasterVolume) * get(AudioMasterVolume);
        AudioMasterVolume.subscribe(gain => { masterVolumeNode.gain.value = gain * gain });
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

        wasInit = true;
    }
};

function postRunAudio(): void {
    const bufferSize = getAudioBuffersSize();
    AudioBufferSize.set(bufferSize);
    const sampleRate = getAudioSampleRate();
    const numAvailableBuffers = getAudioBuffersToReadCount();

    // Context suspended: drain all WASM buffers to keep backend live, skip scheduling.
    if (audioCtx.state !== 'running') {
        if (numAvailableBuffers > 0)
            markAudioBuffersRead(numAvailableBuffers);
        return;
    }

    const bufferDuration = bufferSize / sampleRate;
    const lookahead = currentPlayTime - audioCtx.currentTime;
    const buffersToFillTarget = Math.ceil((TARGET_LOOKAHEAD_S - lookahead) / bufferDuration);
    const buffersToSchedule = Math.max(0, Math.min(numAvailableBuffers, buffersToFillTarget));

    const toDrain = numAvailableBuffers - buffersToSchedule;
    if (toDrain > 0)
        markAudioBuffersRead(toDrain);

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

    const nodesToStop = activeSourceNodes.slice();
    activeSourceNodes.length = 0;
    currentPlayTime = -1;
    const pending = getAudioBuffersToReadCount();
    if (pending > 0) markAudioBuffersRead(pending);

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
        const target = get(AudioMasterVolume) ** 2;
        const now = audioCtx.currentTime;
        const cur = masterVolumeNode.gain.value;
        masterVolumeNode.gain.cancelScheduledValues(now);
        masterVolumeNode.gain.setValueAtTime(cur, now);
        masterVolumeNode.gain.linearRampToValueAtTime(target, now + RESUME_FADE_S);
    });
}
