import { writable } from 'svelte/store';

const DB_NAME = 'svelteboy-batterysaves';
const STORE_NAME = 'battery';

export type BatterySaveEntry = {
    bytes: Uint8Array;
    savedAt: number;
};

export const batterySaveVersion = writable(0);

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            (e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
        req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
}

export async function saveBattery(sha1: string, bytes: Uint8Array): Promise<void> {
    const db = await openDb();
    const entry: BatterySaveEntry = { bytes, savedAt: Date.now() };
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(entry, sha1);
        tx.oncomplete = () => { batterySaveVersion.update(v => v + 1); resolve(); };
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadBattery(sha1: string): Promise<BatterySaveEntry | undefined> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(sha1);
        req.onsuccess = () => resolve((req.result as BatterySaveEntry) ?? undefined);
        req.onerror = () => reject(req.error);
    });
}

export async function deleteBattery(sha1: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(sha1);
        tx.oncomplete = () => { batterySaveVersion.update(v => v + 1); resolve(); };
        tx.onerror = () => reject(tx.error);
    });
}
