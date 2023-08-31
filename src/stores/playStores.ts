import { writable } from "svelte/store";
import { InputType } from "../types";

export const GamePlaying = writable<boolean>(false);
export const GameFrames = writable<number>(0);
export const KeyPressMap = writable<Set<InputType>>(new Set<InputType>())
