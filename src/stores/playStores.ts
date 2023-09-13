import { writable } from "svelte/store";
import { InputType, type SaveGameData } from "../types";

export const GameFrames = writable<number>(0);
export const KeyPressMap = writable<Set<InputType>>(new Set<InputType>())
export const EmulatorInitialized = writable<boolean>(false);
export const EmulatorPaused = writable<boolean>(true);
export const EmulatorBusy = writable<boolean>(false);
export const AutoSave = writable<SaveGameData>(undefined);
export const SaveGames = writable<SaveGameData[]>([]);
