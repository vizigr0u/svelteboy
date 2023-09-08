import { writable } from "svelte/store";
import { MakeLocalStore } from "./localStorageStore";

export const useBoot = writable<boolean>(false);
export const frameDelay = MakeLocalStore<number>('option-frame-delay', 7);
export const playerPixelSize = MakeLocalStore<number>('option-pixel-size', 3);
export const showFPS = MakeLocalStore<boolean>('option-show-fps', false);
export const HideKeyboardWarning = MakeLocalStore<boolean>('option-hide-keyboard-warning', false);
export const DismissSavesWarning = MakeLocalStore<boolean>('option-hide-saves-warning', false);
export const RemoteRomsListUri = MakeLocalStore<string>('option-remote-roms-list-uri', "");
