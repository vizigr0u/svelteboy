import { writable } from "svelte/store";

export const useBoot = writable<boolean>(false);
export const frameDelay = writable<number>(7);
export const playerPixelSize = writable<number>(3);
