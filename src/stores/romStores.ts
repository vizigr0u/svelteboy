import { writable } from "svelte/store";
import type { BootRomEntry, LibraryRom, RomReference } from "../types";
import { makeBootRomStore } from "./idbStore";

export const bootRomStore = makeBootRomStore<BootRomEntry>();

export const loadedBootRom = writable<RomReference | undefined>(undefined);
export const loadedCartridge = writable<LibraryRom | undefined>(undefined);
