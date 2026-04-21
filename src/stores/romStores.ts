import { writable } from "svelte/store";
import type { RomReference } from "../types";
import { makeRomStore } from "./idbStore";

export const bootRomStore = makeRomStore("boot_roms");
export const cartRomStore = makeRomStore("cart_roms");

export const loadedBootRom = writable<RomReference>(undefined);
export const loadedCartridge = writable<RomReference>(undefined);
