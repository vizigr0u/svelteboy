import { writable } from "svelte/store";
import type { LibraryRom } from "../types";

// Drives the single RomContextMenu instance. Cards open it on right-click /
// long-press; the menu hosts library ops that used to live in RomDrawer.
export type RomMenuState = { rom: LibraryRom; x: number; y: number };

export const romMenu = writable<RomMenuState | null>(null);

export function openRomMenu(rom: LibraryRom, x: number, y: number): void {
    romMenu.set({ rom, x, y });
}

export function closeRomMenu(): void {
    romMenu.set(null);
}
