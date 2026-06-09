import { writable } from "svelte/store";
import { pauseEmulator } from "../emulator/lifecycle";

export const playViewActive = writable<boolean>(false);

export function goToPlay(): void {
    playViewActive.set(true);
}

export function goToHome(): void {
    pauseEmulator();
    playViewActive.set(false);
}
