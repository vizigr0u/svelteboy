import { get, writable } from "svelte/store";
import { pauseEmulator, runUntilBreak } from "../emulator/lifecycle";
import { snapNow } from "../emulator/autoSnap";
import { EmulatorInitialized } from "./playStores";
import { DebuggerAttached } from "./debugStores";
import { shouldAutoResumeOnEnterPlay } from "./viewResume";

export const playViewActive = writable<boolean>(false);

export function goToPlay(): void {
    playViewActive.set(true);
    if (shouldAutoResumeOnEnterPlay({
        emulatorInitialized: get(EmulatorInitialized),
        debuggerAttached: get(DebuggerAttached),
    })) {
        runUntilBreak();
    }
}

export async function goToHome(): Promise<void> {
    await snapNow('exit').catch(() => {});
    pauseEmulator();
    playViewActive.set(false);
}
