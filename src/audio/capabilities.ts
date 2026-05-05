export type AudioCapability = 'worklet' | 'fallback' | 'none';

export type AudioCapabilityEnv = {
    hasAudioContext: boolean;
    hasAudioWorkletNode: boolean;
    hasSharedArrayBuffer: boolean;
    crossOriginIsolated: boolean;
};

export function detectAudioCapability(env: AudioCapabilityEnv): AudioCapability {
    if (!env.hasAudioContext) return 'none';
    if (env.hasAudioWorkletNode && env.hasSharedArrayBuffer && env.crossOriginIsolated) {
        return 'worklet';
    }
    return 'fallback';
}

export function probeAudioCapability(g: typeof globalThis = globalThis): AudioCapability {
    const w = g as any;
    return detectAudioCapability({
        hasAudioContext: typeof w.AudioContext === 'function' || typeof w.webkitAudioContext === 'function',
        hasAudioWorkletNode: typeof w.AudioWorkletNode === 'function',
        hasSharedArrayBuffer: typeof w.SharedArrayBuffer === 'function',
        crossOriginIsolated: w.crossOriginIsolated === true,
    });
}
