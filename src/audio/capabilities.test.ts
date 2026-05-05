import { describe, it, expect } from 'vitest';
import { detectAudioCapability, type AudioCapabilityEnv } from './capabilities';

function env(overrides: Partial<AudioCapabilityEnv> = {}): AudioCapabilityEnv {
    return {
        hasAudioContext: true,
        hasAudioWorkletNode: true,
        hasSharedArrayBuffer: true,
        crossOriginIsolated: true,
        ...overrides,
    };
}

describe('detectAudioCapability', () => {
    it('returns worklet when isolated + SAB + AudioWorkletNode + AudioContext', () => {
        expect(detectAudioCapability(env())).toBe('worklet');
    });

    it('returns fallback when not crossOriginIsolated', () => {
        expect(detectAudioCapability(env({ crossOriginIsolated: false }))).toBe('fallback');
    });

    it('returns fallback when SharedArrayBuffer absent', () => {
        expect(detectAudioCapability(env({ hasSharedArrayBuffer: false }))).toBe('fallback');
    });

    it('returns fallback when AudioWorkletNode absent', () => {
        expect(detectAudioCapability(env({ hasAudioWorkletNode: false }))).toBe('fallback');
    });

    it('returns fallback when isolated but webworker context cannot be tested', () => {
        expect(detectAudioCapability(env({ crossOriginIsolated: false, hasSharedArrayBuffer: false }))).toBe('fallback');
    });

    it('returns none when AudioContext missing', () => {
        expect(detectAudioCapability(env({ hasAudioContext: false }))).toBe('none');
    });

    it('returns none when no audio API at all', () => {
        expect(detectAudioCapability(env({
            hasAudioContext: false,
            hasAudioWorkletNode: false,
            hasSharedArrayBuffer: false,
            crossOriginIsolated: false,
        }))).toBe('none');
    });
});
