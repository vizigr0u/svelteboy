import { writable } from "svelte/store";
import { MakeIDBStore } from "./idbStore";

export const paletteOpen = writable<boolean>(false);
export const debugUnlocked = MakeIDBStore<boolean>("palette-debug-unlocked", false);

export function openPalette(): void {
    paletteOpen.set(true);
}

export function closePalette(): void {
    paletteOpen.set(false);
}

export function togglePalette(): void {
    paletteOpen.update(v => !v);
}
