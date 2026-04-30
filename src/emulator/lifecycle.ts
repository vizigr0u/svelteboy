import { get } from "svelte/store";
import { initEmulator } from "./wasmBridge";
import { Audio, suspendAudio, resumeAudio } from "./audio";
import { cancelLoop, postRun, requestRunLoop, resetTiming } from "./loop";
import { EmulatorInitialized, EmulatorPaused } from "stores/playStores";
import { DebuggerAttached } from "stores/debugStores";
import { PauseOnVisibilityLost, useBoot } from "stores/optionsStore";

export function pauseEmulator(): void {
    EmulatorPaused.set(true);
    suspendAudio();
    cancelLoop();
    resetTiming();
}

export function unPauseEmulator(): void {
    EmulatorPaused.set(false);
    resumeAudio();
}

export function runUntilBreak(): void {
    resetTiming();
    unPauseEmulator();
    requestRunLoop();
}

export function resetEmulator(): void {
    Audio.Init();
    EmulatorInitialized.set(false);
    initEmulator(get(useBoot));
    EmulatorInitialized.set(true);
    resetTiming();
    postRun();
    if (get(DebuggerAttached))
        pauseEmulator();
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        cancelLoop();
    });
}

let pausedByVisibility = false;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (get(PauseOnVisibilityLost) && !get(EmulatorPaused)) {
            pausedByVisibility = true;
            pauseEmulator();
        }
    } else if (!get(DebuggerAttached) && pausedByVisibility) {
        pausedByVisibility = false;
        runUntilBreak();
    }
});
