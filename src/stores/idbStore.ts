import { writable, type Writable } from 'svelte/store';
import type { LibraryRom, RomSource } from '../types';

const DB_NAME = 'svelteboy';
const DB_VERSION = 2;

const PREF_STORE = 'preferences';
const CART_STORE = 'cart_roms';
const BOOT_STORE = 'boot_roms';
const LIBRARY_STORE = 'library';

const SEEDED_FLAG = 'library-seeded-v2';

export const STORE_NAMES = {
    PREF: PREF_STORE,
    CART: CART_STORE,
    BOOT: BOOT_STORE,
    LIBRARY: LIBRARY_STORE,
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
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
            if (!db.objectStoreNames.contains(LIBRARY_STORE))
                db.createObjectStore(LIBRARY_STORE);
        };
        req.onsuccess = async (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            try { await seedLibraryIfNeeded(db); }
            catch (err) { console.error('Library seed failed:', err); }
            resolve(db);
        };
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

const SHA1_RE = /^[0-9a-f]{40}$/i;

async function sha1Hex(buffer: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-1', buffer);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function sha1OfString(s: string): Promise<string> {
    return sha1Hex(new TextEncoder().encode(s).buffer as ArrayBuffer);
}

export async function normalizeSha1ForUri(rawSha1: string, uri: string): Promise<string> {
    if (rawSha1 && SHA1_RE.test(rawSha1)) return rawSha1.toLowerCase();
    return 'uri:' + (await sha1OfString(uri));
}

async function seedLibraryIfNeeded(db: IDBDatabase): Promise<void> {
    const flag = await new Promise<unknown>((res, rej) => {
        const req = db.transaction(PREF_STORE, 'readonly').objectStore(PREF_STORE).get(SEEDED_FLAG);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
    if (flag) return;

    const cartEntries = await new Promise<Array<{ name: string; sha1: string; fileSize: number; content: ArrayBuffer }>>((res, rej) => {
        const req = db.transaction(CART_STORE, 'readonly').objectStore(CART_STORE).getAll();
        req.onsuccess = () => res(req.result ?? []);
        req.onerror = () => rej(req.error);
    });

    const now = Date.now();
    const seenSha1 = new Set<string>();

    await new Promise<void>((res, rej) => {
        const tx = db.transaction([LIBRARY_STORE, PREF_STORE], 'readwrite');
        const lib = tx.objectStore(LIBRARY_STORE);
        const prefs = tx.objectStore(PREF_STORE);

        let i = 0;
        for (const r of cartEntries) {
            if (seenSha1.has(r.sha1)) continue;
            seenSha1.add(r.sha1);
            const row: LibraryRom = {
                name: r.name,
                sha1: r.sha1,
                source: { kind: 'idb' },
                fileSize: r.fileSize,
                addedAt: now - i,
            };
            lib.put(row, r.sha1);
            i++;
        }
        prefs.put(1, SEEDED_FLAG);

        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
    });
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


export function MakeIDBStore<T>(key: string, defaultValue: T, migrate?: (stored: T) => T): Writable<T> {
    const store = writable<T>(defaultValue);
    let hydrated = false;

    openDB()
        .then(db => prefGet<T>(db, key))
        .then(stored => {
            hydrated = true;
            if (stored === undefined) return;
            const migrated = migrate ? migrate(stored) : stored;
            store.set(migrated);
            if (migrate && migrated !== stored)
                openDB().then(db => prefSet(db, key, migrated));
        });

    store.subscribe(value => {
        if (!hydrated) return;
        openDB().then(db => prefSet(db, key, value ?? defaultValue));
    });

    return store;
}

export function makeBootRomStore<T extends { sha1: string }>(): Writable<T[]> {
    const store = writable<T[]>([]);
    let currentSha1s = new Set<string>();
    let hydrated = false;

    openDB()
        .then(db => new Promise<T[]>((res, rej) => {
            const req = db.transaction(BOOT_STORE, 'readonly').objectStore(BOOT_STORE).getAll();
            req.onsuccess = () => res(req.result ?? []);
            req.onerror = () => rej(req.error);
        }))
        .then(roms => {
            currentSha1s = new Set(roms.map(r => r.sha1));
            hydrated = true;
            store.set(roms);
        });

    store.subscribe(roms => {
        if (!hydrated) return;
        const newSha1s = new Set(roms.map(r => r.sha1));

        openDB().then(db => {
            const tx = db.transaction(BOOT_STORE, 'readwrite');
            const objStore = tx.objectStore(BOOT_STORE);
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

export function libraryGetAll(db: IDBDatabase): Promise<LibraryRom[]> {
    return new Promise((res, rej) => {
        const req = db.transaction(LIBRARY_STORE, 'readonly').objectStore(LIBRARY_STORE).getAll();
        req.onsuccess = () => res(req.result ?? []);
        req.onerror = () => rej(req.error);
    });
}

export function libraryGet(db: IDBDatabase, sha1: string): Promise<LibraryRom | undefined> {
    return new Promise((res, rej) => {
        const req = db.transaction(LIBRARY_STORE, 'readonly').objectStore(LIBRARY_STORE).get(sha1);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

export function cartRomGet(db: IDBDatabase, sha1: string): Promise<ArrayBuffer | undefined> {
    return new Promise((res, rej) => {
        const req = db.transaction(CART_STORE, 'readonly').objectStore(CART_STORE).get(sha1);
        req.onsuccess = () => {
            const row = req.result;
            if (!row) return res(undefined);
            res(row.content ?? row);
        };
        req.onerror = () => rej(req.error);
    });
}

export function txAddIdbRom(
    db: IDBDatabase,
    row: LibraryRom,
    bytes: ArrayBuffer,
): Promise<void> {
    return new Promise((res, rej) => {
        const tx = db.transaction([LIBRARY_STORE, CART_STORE], 'readwrite');
        tx.objectStore(LIBRARY_STORE).put(row, row.sha1);
        tx.objectStore(CART_STORE).put(
            { name: row.name, sha1: row.sha1, fileSize: row.fileSize, content: bytes },
            row.sha1,
        );
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
    });
}

export function txAddUriRom(db: IDBDatabase, row: LibraryRom): Promise<void> {
    return new Promise((res, rej) => {
        const tx = db.transaction(LIBRARY_STORE, 'readwrite');
        tx.objectStore(LIBRARY_STORE).put(row, row.sha1);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
    });
}

export function txDeleteRom(db: IDBDatabase, sha1: string, alsoIdb: boolean): Promise<void> {
    return new Promise((res, rej) => {
        const stores = alsoIdb ? [LIBRARY_STORE, CART_STORE] : [LIBRARY_STORE];
        const tx = db.transaction(stores, 'readwrite');
        tx.objectStore(LIBRARY_STORE).delete(sha1);
        if (alsoIdb) tx.objectStore(CART_STORE).delete(sha1);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
    });
}

export function txPromoteUriToIdb(
    db: IDBDatabase,
    row: LibraryRom,
    bytes: ArrayBuffer,
): Promise<void> {
    return new Promise((res, rej) => {
        const tx = db.transaction([LIBRARY_STORE, CART_STORE], 'readwrite');
        tx.objectStore(LIBRARY_STORE).put(row, row.sha1);
        tx.objectStore(CART_STORE).put(
            { name: row.name, sha1: row.sha1, fileSize: row.fileSize, content: bytes },
            row.sha1,
        );
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
    });
}

export function txReconcileSha1(
    db: IDBDatabase,
    stubSha1: string,
    realRow: LibraryRom,
    bytes: ArrayBuffer | undefined,
): Promise<void> {
    return new Promise((res, rej) => {
        const stores = bytes ? [LIBRARY_STORE, CART_STORE] : [LIBRARY_STORE];
        const tx = db.transaction(stores, 'readwrite');
        const lib = tx.objectStore(LIBRARY_STORE);
        if (stubSha1 !== realRow.sha1) lib.delete(stubSha1);
        lib.put(realRow, realRow.sha1);
        if (bytes) tx.objectStore(CART_STORE).put(
            { name: realRow.name, sha1: realRow.sha1, fileSize: realRow.fileSize, content: bytes },
            realRow.sha1,
        );
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
    });
}
