import { describe, it, expect } from 'vitest';
import { shouldAutoResumeOnEnterPlay } from './viewResume';

describe('shouldAutoResumeOnEnterPlay', () => {
    it('resumes when emulator initialized and debugger not attached', () => {
        expect(shouldAutoResumeOnEnterPlay({
            emulatorInitialized: true,
            debuggerAttached: false,
        })).toBe(true);
    });

    it('does not resume when emulator not initialized', () => {
        expect(shouldAutoResumeOnEnterPlay({
            emulatorInitialized: false,
            debuggerAttached: false,
        })).toBe(false);
    });

    it('does not resume when debugger attached', () => {
        expect(shouldAutoResumeOnEnterPlay({
            emulatorInitialized: true,
            debuggerAttached: true,
        })).toBe(false);
    });

    it('does not resume when both gates fail', () => {
        expect(shouldAutoResumeOnEnterPlay({
            emulatorInitialized: false,
            debuggerAttached: true,
        })).toBe(false);
    });
});
