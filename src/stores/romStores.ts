import { writable, type Writable } from "svelte/store";
import { RomType, type RomReference, type StoredRom } from "../types";

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

export const loadedRomsStore = writable<RomReference[]>([undefined, undefined]);

export function setLoadedRom(romType: RomType, rom: RomReference) {
    loadedRomsStore.update(store => {
        store[romType] = rom;
        return store;
    });
}
