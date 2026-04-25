import { writable, type Writable } from 'svelte/store';
import type { StoredRom } from '../types';

const DB_NAME = 'svelteboy';
const DB_VERSION = 1;

const PREF_STORE = 'preferences';
const CART_STORE = 'cart_roms';
const BOOT_STORE = 'boot_roms';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(PREF_STORE))
                db.createObjectStore(PREF_STORE);
            if (!db.objectStoreNames.contains(CART_STORE))
                db.createObjectStore(CART_STORE);
            if (!db.objectStoreNames.contains(BOOT_STORE))
                db.createObjectStore(BOOT_STORE);
        };
        req.onsuccess = async (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            await migrateLocalStorage(db);
            resolve(db);
        };
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

async function migrateLocalStorage(db: IDBDatabase): Promise<void> {
    if (localStorage.getItem('svelteboy-idb-migrated')) return;

    const romMigrations = [
        { lsKey: 'cartroms', idbStoreName: CART_STORE },
        { lsKey: 'bootroms', idbStoreName: BOOT_STORE },
    ] as const;

    for (const { lsKey, idbStoreName } of romMigrations) {
        const raw = localStorage.getItem(lsKey);
        if (!raw) continue;
        try {
            const roms = JSON.parse(raw) as Array<{ name: string; sha1: string; contentBase64: string; fileSize: number }>;
            const tx = db.transaction(idbStoreName, 'readwrite');
            const objStore = tx.objectStore(idbStoreName);
            for (const rom of roms) {
                const bin = atob(rom.contentBase64);
                const content = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) content[i] = bin.charCodeAt(i);
                objStore.put({ name: rom.name, sha1: rom.sha1, fileSize: rom.fileSize, content: content.buffer }, rom.sha1);
            }
            await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
        } catch (e) {
            console.error(`IDB migration failed for ${lsKey}:`, e);
        }
        localStorage.removeItem(lsKey);
    }

    const prefKeys = [
        'option-pixel-size', 'option-show-fps', 'option-hide-keyboard-warning',
        'option-hide-saves-warning', 'option-remote-roms-list-uri',
        'option-cached-remote-roms', 'option-show-debugger', 'option-master-volume',
        'DebugLogMutedCategories',
        'option-keybindings',
    ];
    const tx = db.transaction(PREF_STORE, 'readwrite');
    const prefStore = tx.objectStore(PREF_STORE);
    for (const key of prefKeys) {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        try { prefStore.put(JSON.parse(raw), key); }
        catch { prefStore.put(raw, key); }
        localStorage.removeItem(key);
    }
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });

    localStorage.setItem('svelteboy-idb-migrated', '1');
}

function prefGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(PREF_STORE, 'readonly').objectStore(PREF_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function prefSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PREF_STORE, 'readwrite');
        tx.objectStore(PREF_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function romGetAll(db: IDBDatabase, storeName: string): Promise<StoredRom[]> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
    });
}

export async function findStoredRomByName(name: string): Promise<StoredRom | undefined> {
    const db = await openDB();
    const roms = await romGetAll(db, CART_STORE);
    const lower = name.toLowerCase();
    return roms.find(r => r.name.toLowerCase() === lower);
}

export async function clearAllStorage(): Promise<void> {
    if (dbPromise) {
        const db = await dbPromise;
        db.close();
        dbPromise = null;
    }
    await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
    });
    localStorage.clear();
}

export function MakeIDBStore<T>(key: string, defaultValue: T): Writable<T> {
    const store = writable<T>(defaultValue);
    let hydrated = false;

    openDB()
        .then(db => prefGet<T>(db, key))
        .then(stored => {
            hydrated = true;
            if (stored !== undefined) store.set(stored);
        });

    store.subscribe(value => {
        if (!hydrated) return;
        openDB().then(db => prefSet(db, key, value ?? defaultValue));
    });

    return store;
}

export function makeRomStore(idbStoreName: typeof CART_STORE | typeof BOOT_STORE): Writable<StoredRom[]> {
    const store = writable<StoredRom[]>([]);
    let currentSha1s = new Set<string>();
    let hydrated = false;

    openDB()
        .then(db => romGetAll(db, idbStoreName))
        .then(roms => {
            currentSha1s = new Set(roms.map(r => r.sha1));
            hydrated = true;
            store.set(roms);
        });

    store.subscribe(roms => {
        if (!hydrated) return;
        const newSha1s = new Set(roms.map(r => r.sha1));

        openDB().then(db => {
            const tx = db.transaction(idbStoreName, 'readwrite');
            const objStore = tx.objectStore(idbStoreName);
            for (const sha1 of currentSha1s) {
                if (!newSha1s.has(sha1)) objStore.delete(sha1);
            }
            for (const rom of roms) {
                if (!currentSha1s.has(rom.sha1)) objStore.put(rom, rom.sha1);
            }
        });
        currentSha1s = newSha1s;
    });

    return store;
}
