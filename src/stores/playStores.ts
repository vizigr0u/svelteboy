import { writable } from "svelte/store";

export const GamePlaying = writable<boolean>(false);
export const GameFrames = writable<number>(0);
