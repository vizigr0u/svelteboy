import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const DB_NAME = 'svelteboy';

async function freshImport() {
    vi.resetModules();
    return {
        idb: await import('./idbStore'),
        lib: await import('./libraryStore'),
    };
}

function sha1Hex(s: string): Promise<string> {
    return crypto.subtle.digest('SHA-1', new TextEncoder().encode(s).buffer as ArrayBuffer)
        .then(d => Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    localStorage.clear();
});

describe('Phase 1 — IDB v2 migration', () => {
    it('seeds library from existing cart_roms on first open', async () => {
        const seedSha1 = await sha1Hex('rom-bytes-1');
        const seedDb = await new Promise<IDBDatabase>((res, rej) => {
            const req = indexedDB.open(DB_NAME, 2);
            req.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                db.createObjectStore('preferences');
                db.createObjectStore('cart_roms');
                db.createObjectStore('boot_roms');
                db.createObjectStore('library');
            };
            req.onsuccess = (e) => res((e.target as IDBOpenDBRequest).result);
            req.onerror = () => rej(req.error);
        });
        await new Promise<void>((res, rej) => {
            const tx = seedDb.transaction('cart_roms', 'readwrite');
            tx.objectStore('cart_roms').put(
                { name: 'Game.gb', sha1: seedSha1, fileSize: 11, content: new Uint8Array([1, 2, 3]).buffer },
                seedSha1,
            );
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
        seedDb.close();

        const { idb } = await freshImport();
        const db = await idb.openDB();
        const rows = await idb.libraryGetAll(db);
        const idbRow = rows.find(r => r.sha1 === seedSha1);
        expect(idbRow).toBeDefined();
        expect(idbRow!.source.kind).toBe('idb');
        expect(idbRow!.fileSize).toBe(11);
        db.close();
    });

    it('does not re-seed on second open', async () => {
        const { idb: idb1 } = await freshImport();
        const db1 = await idb1.openDB();
        const first = await idb1.libraryGetAll(db1);
        db1.close();

        const { idb: idb2 } = await freshImport();
        const db2 = await idb2.openDB();
        const second = await idb2.libraryGetAll(db2);
        expect(second.length).toBe(first.length);
        db2.close();
    });
});

describe('Phase 3 — drop atomicity', () => {
    it('writes library row + cart_roms bytes in single tx', async () => {
        const { idb, lib } = await freshImport();
        const bytes = new Uint8Array([10, 20, 30, 40]);
        const file = new File([bytes], 'TestGame.gb');
        const row = await lib.addLibraryRomFromDrop(file);
        expect(row).toBeDefined();
        expect(row!.source.kind).toBe('idb');
        expect(row!.fileSize).toBe(4);

        const db = await idb.openDB();
        const stored = await idb.libraryGet(db, row!.sha1);
        expect(stored).toBeDefined();
        const fetched = await lib.getBytesBySha1(row!.sha1);
        expect(fetched).toBeDefined();
        expect(new Uint8Array(fetched!)).toEqual(bytes);
        db.close();
    });
});

describe('Phase 5 — dedupe', () => {
    it('skips drop with existing sha1', async () => {
        const { idb, lib } = await freshImport();
        const bytes = new Uint8Array([7, 8, 9]);
        const file1 = new File([bytes], 'A.gb');
        const file2 = new File([bytes], 'B.gb');
        const r1 = await lib.addLibraryRomFromDrop(file1);
        const r2 = await lib.addLibraryRomFromDrop(file2);
        expect(r1!.sha1).toBe(r2!.sha1);
        const db = await idb.openDB();
        const all = await idb.libraryGetAll(db);
        expect(all.filter(r => r.sha1 === r1!.sha1).length).toBe(1);
        db.close();
    });

    it('addLibraryRomFromUri skips dup uri', async () => {
        const { idb, lib } = await freshImport();
        const sha1 = 'a'.repeat(40);
        const r1 = await lib.addLibraryRomFromUri({ sha1, name: 'X', uri: 'https://e.x/a.gb' });
        const r2 = await lib.addLibraryRomFromUri({ sha1, name: 'X-dup', uri: 'https://e.x/a.gb' });
        expect(r1.sha1).toBe(r2.sha1);
        const db = await idb.openDB();
        const all = await idb.libraryGetAll(db);
        expect(all.filter(r => r.sha1 === sha1).length).toBe(1);
        db.close();
    });
});
