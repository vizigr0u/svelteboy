import { writable, type Writable } from "svelte/store";
import { type RomReference, type StoredRom } from "../types";

const bootromKey = "bootroms";
const storedBootRoms = JSON.parse(localStorage.getItem(bootromKey)) as StoredRom[] ?? [];

export const bootRomStore: Writable<StoredRom[]> = writable<StoredRom[]>(storedBootRoms);
bootRomStore.subscribe(value => {
    localStorage.setItem(bootromKey, JSON.stringify(value?.length > 0 ? value : []));
});

const cartRomKey = "cartroms";
const storedcartRoms = JSON.parse(localStorage.getItem(cartRomKey)) as StoredRom[] ?? [];

export const cartRomStore: Writable<StoredRom[]> = writable<StoredRom[]>(storedcartRoms);
cartRomStore.subscribe(value => {
    localStorage.setItem(cartRomKey, JSON.stringify(!!value ? value : []));
});

export const loadedBootRom = writable<RomReference>(undefined);
export const loadedCartridge = writable<RomReference>(undefined);
