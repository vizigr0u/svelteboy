import { writable } from "svelte/store";
import { type RomReference, type StoredRom } from "../types";
import { MakeLocalStore } from "./localStorageStore";

export const bootRomStore = MakeLocalStore<StoredRom[]>("bootroms", []);
export const cartRomStore = MakeLocalStore<StoredRom[]>("cartroms", []);

export const loadedBootRom = writable<RomReference>(undefined);
export const loadedCartridge = writable<RomReference>(undefined);
