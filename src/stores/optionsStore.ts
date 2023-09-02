import { writable } from "svelte/store";
import { MakeLocalStore } from "./localStorageStore";

export const useBoot = writable<boolean>(false);
export const frameDelay = MakeLocalStore<number>('option-frame-delay', 7);
export const playerPixelSize = MakeLocalStore<number>('option-pixel-size', 3);
