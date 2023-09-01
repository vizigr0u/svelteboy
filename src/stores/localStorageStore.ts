import { writable, type Writable } from "svelte/store";

export function MakeLocalStore<T>(key: string, defaultValue: T): Writable<T> {
    const storedValue = JSON.parse(localStorage.getItem(key)) as T ?? defaultValue;

    const store = writable<T>(storedValue);
    store.subscribe(value => {
        localStorage.setItem(key, JSON.stringify(value ? value : defaultValue));
    });
    return store;
}