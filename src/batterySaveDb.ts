import { writable } from 'svelte/store';

const DB_NAME = 'svelteboy-batterysaves';
const DB_VERSION = 2;
const STORE_BANKS = 'banks';
const STORE_META = 'meta';
const STORE_RING = 'autoring';
const LEGACY_STORE = 'battery';

const RING_SIZE = 3;
const DEFAULT_BANK_ID = 'default';
const DEFAULT_BANK_NAME = 'Default';

export type BatterySaveEntry = {
    bytes: Uint8Array;
    savedAt: number;
};

export type BankInfo = {
    id: string;
    name: string;
    size: number;
    savedAt: number;
};

export type BatteryBankEntry = {
    bytes: Uint8Array;
    savedAt: number;
    name: string;
};

export type BatteryRingEntry = {
    bytes: Uint8Array;
    savedAt: number;
    sourceBank: string;
};

type BatteryMeta = {
    activeBank: string;
    ringHead: number;
};

export const batterySaveVersion = writable(0);

function bankKey(sha1: string, bankId: string): string { return `${sha1}::bank::${bankId}`; }
function ringKey(sha1: string, idx: number): string { return `${sha1}::ring::${idx}`; }
function bankRange(sha1: string): IDBKeyRange { return IDBKeyRange.bound(`${sha1}::bank::`, `${sha1}::bank::\uFFFF`); }
function ringRange(sha1: string): IDBKeyRange { return IDBKeyRange.bound(`${sha1}::ring::`, `${sha1}::ring::\uFFFF`); }

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            const tx = (e.target as IDBOpenDBRequest).transaction!;

            if (!db.objectStoreNames.contains(STORE_BANKS)) db.createObjectStore(STORE_BANKS);
            if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
            if (!db.objectStoreNames.contains(STORE_RING)) db.createObjectStore(STORE_RING);

            if (db.objectStoreNames.contains(LEGACY_STORE)) {
                try {
                    const oldStore = tx.objectStore(LEGACY_STORE);
                    const banks = tx.objectStore(STORE_BANKS);
                    const meta = tx.objectStore(STORE_META);
                    const cursorReq = oldStore.openCursor();
                    cursorReq.onsuccess = (ev) => {
                        const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
                        if (cursor) {
                            const sha1 = cursor.key as string;
                            const old = cursor.value as { bytes: Uint8Array; savedAt: number };
                            const bankEntry: BatteryBankEntry = { bytes: old.bytes, savedAt: old.savedAt, name: DEFAULT_BANK_NAME };
                            banks.put(bankEntry, bankKey(sha1, DEFAULT_BANK_ID));
                            const metaEntry: BatteryMeta = { activeBank: DEFAULT_BANK_ID, ringHead: 0 };
                            meta.put(metaEntry, sha1);
                            cursor.continue();
                        } else {
                            // Cursor walk completed without error; safe to drop legacy store.
                            db.deleteObjectStore(LEGACY_STORE);
                        }
                    };
                    cursorReq.onerror = (ev) => {
                        // Leave legacy store in place so a future upgrade can retry.
                        console.error('battery v1→v2 migration cursor failed', (ev.target as IDBRequest).error);
                    };
                } catch (err) {
                    console.error('battery v1→v2 migration setup failed', err);
                }
            }
        };
        req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
        req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
}

function bumpVersion(): void { batterySaveVersion.update(v => v + 1); }

function reqAsync<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function txComplete(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

// ──────────────────────────────────────────────────────────────────
// Banks
// ──────────────────────────────────────────────────────────────────

export async function listBanks(sha1: string): Promise<BankInfo[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_BANKS, 'readonly');
    const store = tx.objectStore(STORE_BANKS);
    const out: BankInfo[] = [];
    const cursorReq = store.openCursor(bankRange(sha1));
    await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                const key = cursor.key as string;
                const id = key.slice(`${sha1}::bank::`.length);
                const v = cursor.value as BatteryBankEntry;
                out.push({ id, name: v.name, size: v.bytes.byteLength, savedAt: v.savedAt });
                cursor.continue();
            } else resolve();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
    });
    return out;
}

export async function loadBank(sha1: string, bankId: string): Promise<Uint8Array | undefined> {
    const db = await openDb();
    const tx = db.transaction(STORE_BANKS, 'readonly');
    const entry = await reqAsync(tx.objectStore(STORE_BANKS).get(bankKey(sha1, bankId))) as BatteryBankEntry | undefined;
    return entry?.bytes;
}

export async function writeBank(sha1: string, bankId: string, bytes: Uint8Array, name?: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_BANKS, 'readwrite');
    const store = tx.objectStore(STORE_BANKS);
    const existing = await reqAsync(store.get(bankKey(sha1, bankId))) as BatteryBankEntry | undefined;
    const finalName = name ?? existing?.name ?? (bankId === DEFAULT_BANK_ID ? DEFAULT_BANK_NAME : bankId);
    const entry: BatteryBankEntry = { bytes, savedAt: Date.now(), name: finalName };
    store.put(entry, bankKey(sha1, bankId));
    await txComplete(tx);
    bumpVersion();
}

export async function renameBank(sha1: string, bankId: string, name: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_BANKS, 'readwrite');
    const store = tx.objectStore(STORE_BANKS);
    const existing = await reqAsync(store.get(bankKey(sha1, bankId))) as BatteryBankEntry | undefined;
    if (!existing) { await txComplete(tx); return; }
    store.put({ ...existing, name }, bankKey(sha1, bankId));
    await txComplete(tx);
    bumpVersion();
}

export async function deleteBank(sha1: string, bankId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_BANKS, 'readwrite');
    tx.objectStore(STORE_BANKS).delete(bankKey(sha1, bankId));
    await txComplete(tx);
    bumpVersion();
}

export async function duplicateBank(sha1: string, srcBankId: string, newName: string): Promise<string> {
    const db = await openDb();
    const tx = db.transaction(STORE_BANKS, 'readwrite');
    const store = tx.objectStore(STORE_BANKS);
    const src = await reqAsync(store.get(bankKey(sha1, srcBankId))) as BatteryBankEntry | undefined;
    if (!src) { await txComplete(tx); throw new Error(`bank ${srcBankId} not found`); }
    const newId = generateBankId();
    store.put({ bytes: src.bytes, savedAt: Date.now(), name: newName }, bankKey(sha1, newId));
    await txComplete(tx);
    bumpVersion();
    return newId;
}

export function generateBankId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().slice(0, 8);
    }
    return `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ──────────────────────────────────────────────────────────────────
// Meta (active bank + ring head)
// ──────────────────────────────────────────────────────────────────

async function readMetaIn(tx: IDBTransaction, sha1: string): Promise<BatteryMeta> {
    const m = await reqAsync(tx.objectStore(STORE_META).get(sha1)) as BatteryMeta | undefined;
    return m ?? { activeBank: DEFAULT_BANK_ID, ringHead: 0 };
}

export async function getActiveBank(sha1: string): Promise<string> {
    const db = await openDb();
    const tx = db.transaction(STORE_META, 'readonly');
    const meta = await readMetaIn(tx, sha1);
    return meta.activeBank;
}

export async function setActiveBank(sha1: string, bankId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_META, 'readwrite');
    const meta = await readMetaIn(tx, sha1);
    tx.objectStore(STORE_META).put({ ...meta, activeBank: bankId }, sha1);
    await txComplete(tx);
    bumpVersion();
}

// ──────────────────────────────────────────────────────────────────
// Auto-backup ring
// ──────────────────────────────────────────────────────────────────

// ringHead modulo cap keeps the counter bounded; only (head % RING_SIZE) controls the slot.
const RING_HEAD_WRAP = RING_SIZE * 1000;

export async function pushRing(sha1: string, bytes: Uint8Array, sourceBank: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE_RING, STORE_META], 'readwrite');
    const meta = await readMetaIn(tx, sha1);
    const idx = meta.ringHead % RING_SIZE;
    const entry: BatteryRingEntry = { bytes, savedAt: Date.now(), sourceBank };
    tx.objectStore(STORE_RING).put(entry, ringKey(sha1, idx));
    tx.objectStore(STORE_META).put({ ...meta, ringHead: (meta.ringHead + 1) % RING_HEAD_WRAP }, sha1);
    await txComplete(tx);
    bumpVersion();
}

export async function listRing(sha1: string): Promise<BatteryRingEntry[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_RING, 'readonly');
    const store = tx.objectStore(STORE_RING);
    const out: BatteryRingEntry[] = [];
    const cursorReq = store.openCursor(ringRange(sha1));
    await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                out.push(cursor.value as BatteryRingEntry);
                cursor.continue();
            } else resolve();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
    });
    return out.sort((a, b) => b.savedAt - a.savedAt);
}

// ──────────────────────────────────────────────────────────────────
// Legacy API (back-compat: writes to "default", reads from active)
// ──────────────────────────────────────────────────────────────────

export async function saveBattery(sha1: string, bytes: Uint8Array): Promise<void> {
    await writeBank(sha1, DEFAULT_BANK_ID, bytes, DEFAULT_BANK_NAME);
}

export async function loadBattery(sha1: string): Promise<BatterySaveEntry | undefined> {
    const active = await getActiveBank(sha1);
    const db = await openDb();
    const tx = db.transaction(STORE_BANKS, 'readonly');
    const entry = await reqAsync(tx.objectStore(STORE_BANKS).get(bankKey(sha1, active))) as BatteryBankEntry | undefined;
    if (!entry) return undefined;
    return { bytes: entry.bytes, savedAt: entry.savedAt };
}

export async function deleteBattery(sha1: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE_BANKS, STORE_META, STORE_RING], 'readwrite');
    const banks = tx.objectStore(STORE_BANKS);
    const cursorReq = banks.openCursor(bankRange(sha1));
    await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) { cursor.delete(); cursor.continue(); } else resolve();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
    });
    const ringStore = tx.objectStore(STORE_RING);
    const ringCursorReq = ringStore.openCursor(ringRange(sha1));
    await new Promise<void>((resolve, reject) => {
        ringCursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) { cursor.delete(); cursor.continue(); } else resolve();
        };
        ringCursorReq.onerror = () => reject(ringCursorReq.error);
    });
    tx.objectStore(STORE_META).delete(sha1);
    await txComplete(tx);
    bumpVersion();
}
