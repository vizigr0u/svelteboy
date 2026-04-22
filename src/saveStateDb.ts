const DB_NAME = 'svelteboy-savestates';
const STORE_NAME = 'states';

export type SaveStateEntry = {
    state: Uint8Array;
    thumbnail: string;
    savedAt: number;
};

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

function slotKey(romSha1: string, slot: number): string {
    return `${romSha1}:slot${slot}`;
}

export async function saveSlot(romSha1: string, slot: number, entry: SaveStateEntry): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(entry, slotKey(romSha1, slot));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadSlot(romSha1: string, slot: number): Promise<SaveStateEntry | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(slotKey(romSha1, slot));
        req.onsuccess = () => resolve((req.result as SaveStateEntry) ?? null);
        req.onerror = () => reject(req.error);
    });
}

export async function getAllSlots(romSha1: string, count: number): Promise<(SaveStateEntry | null)[]> {
    return Promise.all(Array.from({ length: count }, (_, i) => loadSlot(romSha1, i + 1)));
}
