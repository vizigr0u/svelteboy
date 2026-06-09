import { writable, derived, get } from "svelte/store";
import type { BootRomEntry, LibraryRom, RomReference } from "../types";
import { makeBootRomStore, MakeIDBStore } from "./idbStore";

export const bootRomStore = makeBootRomStore<BootRomEntry>();

export const loadedBootRom = writable<RomReference | undefined>(undefined);
export const loadedCartridge = writable<LibraryRom | undefined>(undefined);

export type PerRomPrefs = {
    skipBootRom?: boolean;
    mutedChannels?: number[];
    notes?: string;
    quickSaveSlotCount?: number;
    rtcOffsetSec?: number;
};

export const perRomPrefs = MakeIDBStore<Record<string, PerRomPrefs>>('perRomPrefs', {});

export function getPrefsFor(sha1: string): PerRomPrefs {
    return get(perRomPrefs)[sha1] ?? {};
}

export function setPrefsFor(sha1: string, patch: Partial<PerRomPrefs>): void {
    perRomPrefs.update(map => ({ ...map, [sha1]: { ...(map[sha1] ?? {}), ...patch } }));
}

export function prefsForRom(sha1: string) {
    return derived(perRomPrefs, map => map[sha1] ?? {});
}
