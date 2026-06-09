import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

async function freshImport() {
    vi.resetModules();
    return await import('./batterySaveDb');
}

beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
});

describe('batterySaveDb: legacy single-entry API', () => {
    it('round-trips bytes for a given sha1', async () => {
        const mod = await freshImport();
        const sha1 = 'a'.repeat(40);
        const bytes = new Uint8Array([1, 2, 3, 4, 0xff, 0x00, 0xaa]);
        await mod.saveBattery(sha1, bytes);
        const loaded = await mod.loadBattery(sha1);
        expect(loaded).toBeDefined();
        expect(loaded!.bytes).toEqual(bytes);
        expect(loaded!.savedAt).toBeGreaterThan(0);
    });

    it('returns undefined when sha1 not present', async () => {
        const mod = await freshImport();
        const out = await mod.loadBattery('b'.repeat(40));
        expect(out).toBeUndefined();
    });

    it('overwrites existing battery save (default bank)', async () => {
        const mod = await freshImport();
        const sha1 = 'c'.repeat(40);
        await mod.saveBattery(sha1, new Uint8Array([1, 2, 3]));
        await mod.saveBattery(sha1, new Uint8Array([9, 8, 7]));
        const loaded = await mod.loadBattery(sha1);
        expect(loaded!.bytes).toEqual(new Uint8Array([9, 8, 7]));
    });

    it('deletes battery save', async () => {
        const mod = await freshImport();
        const sha1 = 'd'.repeat(40);
        await mod.saveBattery(sha1, new Uint8Array([1]));
        await mod.deleteBattery(sha1);
        const loaded = await mod.loadBattery(sha1);
        expect(loaded).toBeUndefined();
    });

    it('isolates saves between sha1s', async () => {
        const mod = await freshImport();
        const a = 'e'.repeat(40), b = 'f'.repeat(40);
        await mod.saveBattery(a, new Uint8Array([1]));
        await mod.saveBattery(b, new Uint8Array([2]));
        expect((await mod.loadBattery(a))!.bytes).toEqual(new Uint8Array([1]));
        expect((await mod.loadBattery(b))!.bytes).toEqual(new Uint8Array([2]));
    });
});

describe('batterySaveDb: banks', () => {
    it('listBanks returns empty array when no banks exist', async () => {
        const mod = await freshImport();
        const banks = await mod.listBanks('1'.repeat(40));
        expect(banks).toEqual([]);
    });

    it('writeBank persists bytes + name, listBanks returns it', async () => {
        const mod = await freshImport();
        const sha1 = '2'.repeat(40);
        await mod.writeBank(sha1, 'default', new Uint8Array([7, 8]), 'Default');
        const banks = await mod.listBanks(sha1);
        expect(banks).toHaveLength(1);
        expect(banks[0].id).toBe('default');
        expect(banks[0].name).toBe('Default');
        expect(banks[0].size).toBe(2);
        expect(banks[0].savedAt).toBeGreaterThan(0);
    });

    it('loadBank returns bytes for written bank', async () => {
        const mod = await freshImport();
        const sha1 = '3'.repeat(40);
        const bytes = new Uint8Array([10, 20, 30]);
        await mod.writeBank(sha1, 'run2', bytes, 'Run 2');
        const got = await mod.loadBank(sha1, 'run2');
        expect(got).toEqual(bytes);
    });

    it('loadBank returns undefined for missing bank', async () => {
        const mod = await freshImport();
        const got = await mod.loadBank('4'.repeat(40), 'nope');
        expect(got).toBeUndefined();
    });

    it('writeBank preserves existing name when name omitted', async () => {
        const mod = await freshImport();
        const sha1 = '5'.repeat(40);
        await mod.writeBank(sha1, 'a', new Uint8Array([1]), 'Alpha');
        await mod.writeBank(sha1, 'a', new Uint8Array([2]));
        const banks = await mod.listBanks(sha1);
        expect(banks[0].name).toBe('Alpha');
        const bytes = await mod.loadBank(sha1, 'a');
        expect(bytes).toEqual(new Uint8Array([2]));
    });

    it('renameBank changes display name only', async () => {
        const mod = await freshImport();
        const sha1 = '6'.repeat(40);
        await mod.writeBank(sha1, 'a', new Uint8Array([1, 2]), 'Old');
        await mod.renameBank(sha1, 'a', 'New');
        const banks = await mod.listBanks(sha1);
        expect(banks[0].name).toBe('New');
        const bytes = await mod.loadBank(sha1, 'a');
        expect(bytes).toEqual(new Uint8Array([1, 2]));
    });

    it('deleteBank removes one bank, leaves others', async () => {
        const mod = await freshImport();
        const sha1 = '7'.repeat(40);
        await mod.writeBank(sha1, 'a', new Uint8Array([1]), 'A');
        await mod.writeBank(sha1, 'b', new Uint8Array([2]), 'B');
        await mod.deleteBank(sha1, 'a');
        const banks = await mod.listBanks(sha1);
        expect(banks).toHaveLength(1);
        expect(banks[0].id).toBe('b');
    });

    it('duplicateBank copies bytes under new id with new name', async () => {
        const mod = await freshImport();
        const sha1 = '8'.repeat(40);
        await mod.writeBank(sha1, 'src', new Uint8Array([1, 2, 3]), 'Source');
        const newId = await mod.duplicateBank(sha1, 'src', 'Copy');
        expect(newId).not.toBe('src');
        const banks = await mod.listBanks(sha1);
        expect(banks).toHaveLength(2);
        const copyBytes = await mod.loadBank(sha1, newId);
        expect(copyBytes).toEqual(new Uint8Array([1, 2, 3]));
        const copyEntry = banks.find(b => b.id === newId)!;
        expect(copyEntry.name).toBe('Copy');
    });

    it('isolates banks between sha1s', async () => {
        const mod = await freshImport();
        const a = '9'.repeat(40), b = '0'.repeat(40);
        await mod.writeBank(a, 'x', new Uint8Array([1]), 'X');
        await mod.writeBank(b, 'x', new Uint8Array([2]), 'X');
        expect(await mod.loadBank(a, 'x')).toEqual(new Uint8Array([1]));
        expect(await mod.loadBank(b, 'x')).toEqual(new Uint8Array([2]));
    });
});

describe('batterySaveDb: active bank meta', () => {
    it('getActiveBank returns "default" when unset', async () => {
        const mod = await freshImport();
        const active = await mod.getActiveBank('a'.repeat(40));
        expect(active).toBe('default');
    });

    it('setActiveBank persists across reads', async () => {
        const mod = await freshImport();
        const sha1 = 'b'.repeat(40);
        await mod.setActiveBank(sha1, 'run2');
        expect(await mod.getActiveBank(sha1)).toBe('run2');
    });

    it('active bank is per-sha1', async () => {
        const mod = await freshImport();
        const a = 'c'.repeat(40), b = 'd'.repeat(40);
        await mod.setActiveBank(a, 'foo');
        await mod.setActiveBank(b, 'bar');
        expect(await mod.getActiveBank(a)).toBe('foo');
        expect(await mod.getActiveBank(b)).toBe('bar');
    });
});

describe('batterySaveDb: auto-backup ring (3 slots, round-robin)', () => {
    it('listRing is empty initially', async () => {
        const mod = await freshImport();
        const ring = await mod.listRing('a'.repeat(40));
        expect(ring).toEqual([]);
    });

    it('pushRing stores entry with sourceBank + savedAt', async () => {
        const mod = await freshImport();
        const sha1 = 'b'.repeat(40);
        await mod.pushRing(sha1, new Uint8Array([1, 2]), 'default');
        const ring = await mod.listRing(sha1);
        expect(ring).toHaveLength(1);
        expect(ring[0].bytes).toEqual(new Uint8Array([1, 2]));
        expect(ring[0].sourceBank).toBe('default');
        expect(ring[0].savedAt).toBeGreaterThan(0);
    });

    it('ring caps at 3 entries, overwriting oldest first', async () => {
        const mod = await freshImport();
        const sha1 = 'c'.repeat(40);
        for (let i = 1; i <= 5; i++) {
            await mod.pushRing(sha1, new Uint8Array([i]), 'default');
        }
        const ring = await mod.listRing(sha1);
        expect(ring).toHaveLength(3);
        const payloads = ring.map(e => e.bytes[0]).sort();
        expect(payloads).toEqual([3, 4, 5]);
    });

    it('listRing sorts newest first', async () => {
        const mod = await freshImport();
        const sha1 = 'e'.repeat(40);
        await mod.pushRing(sha1, new Uint8Array([1]), 'default');
        await new Promise(r => setTimeout(r, 2));
        await mod.pushRing(sha1, new Uint8Array([2]), 'default');
        await new Promise(r => setTimeout(r, 2));
        await mod.pushRing(sha1, new Uint8Array([3]), 'default');
        const ring = await mod.listRing(sha1);
        expect(ring[0].bytes[0]).toBe(3);
        expect(ring[2].bytes[0]).toBe(1);
    });

    it('ring is isolated per-sha1', async () => {
        const mod = await freshImport();
        const a = 'f'.repeat(40), b = '1'.repeat(40);
        await mod.pushRing(a, new Uint8Array([10]), 'default');
        await mod.pushRing(b, new Uint8Array([20]), 'default');
        const ringA = await mod.listRing(a);
        const ringB = await mod.listRing(b);
        expect(ringA[0].bytes[0]).toBe(10);
        expect(ringB[0].bytes[0]).toBe(20);
    });
});

describe('batterySaveDb: v1 → v2 migration', () => {
    function openV1AndSeed(sha1: string, bytes: Uint8Array, savedAt: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('svelteboy-batterysaves', 1);
            req.onupgradeneeded = (e) => {
                (e.target as IDBOpenDBRequest).result.createObjectStore('battery');
            };
            req.onsuccess = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                const tx = db.transaction('battery', 'readwrite');
                tx.objectStore('battery').put({ bytes, savedAt }, sha1);
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
        });
    }

    it('migrates v1 single entry to "default" bank + meta', async () => {
        const sha1 = 'a'.repeat(40);
        const bytes = new Uint8Array([7, 8, 9]);
        await openV1AndSeed(sha1, bytes, 1700000000000);

        const mod = await freshImport();
        const banks = await mod.listBanks(sha1);
        expect(banks).toHaveLength(1);
        expect(banks[0].id).toBe('default');
        expect(banks[0].name).toBe('Default');
        expect(banks[0].savedAt).toBe(1700000000000);

        const got = await mod.loadBank(sha1, 'default');
        expect(got).toEqual(bytes);

        const active = await mod.getActiveBank(sha1);
        expect(active).toBe('default');
    });

    it('legacy loadBattery still works on migrated data', async () => {
        const sha1 = 'b'.repeat(40);
        await openV1AndSeed(sha1, new Uint8Array([42, 42]), 1700000000000);
        const mod = await freshImport();
        const entry = await mod.loadBattery(sha1);
        expect(entry!.bytes).toEqual(new Uint8Array([42, 42]));
    });
});

describe('batterySaveDb: legacy adapters route through bank API', () => {
    it('saveBattery writes to "default" bank', async () => {
        const mod = await freshImport();
        const sha1 = '2'.repeat(40);
        await mod.saveBattery(sha1, new Uint8Array([42]));
        const bytes = await mod.loadBank(sha1, 'default');
        expect(bytes).toEqual(new Uint8Array([42]));
    });

    it('loadBattery reads from active bank', async () => {
        const mod = await freshImport();
        const sha1 = '3'.repeat(40);
        await mod.writeBank(sha1, 'default', new Uint8Array([1]), 'Default');
        await mod.writeBank(sha1, 'run2', new Uint8Array([99]), 'Run 2');
        await mod.setActiveBank(sha1, 'run2');
        const entry = await mod.loadBattery(sha1);
        expect(entry!.bytes).toEqual(new Uint8Array([99]));
    });
});

describe('batterySaveDb: meta concurrency', () => {
    it('setActiveBank + pushRing concurrent: both effects persist', async () => {
        const mod = await freshImport();
        const sha1 = '4'.repeat(40);
        // Seed ringHead to a known value first.
        await mod.pushRing(sha1, new Uint8Array([1]), 'default');
        // Race a switch with another ring push: both must commit.
        await Promise.all([
            mod.setActiveBank(sha1, 'run2'),
            mod.pushRing(sha1, new Uint8Array([2]), 'default'),
        ]);
        expect(await mod.getActiveBank(sha1)).toBe('run2');
        const ring = await mod.listRing(sha1);
        expect(ring.length).toBeGreaterThanOrEqual(2);
    });

    it('many concurrent pushRing calls each occupy a slot', async () => {
        const mod = await freshImport();
        const sha1 = '5'.repeat(40);
        await Promise.all([
            mod.pushRing(sha1, new Uint8Array([1]), 'default'),
            mod.pushRing(sha1, new Uint8Array([2]), 'default'),
            mod.pushRing(sha1, new Uint8Array([3]), 'default'),
        ]);
        const ring = await mod.listRing(sha1);
        expect(ring.length).toBe(3);
    });
});

describe('batterySaveDb: deleteBank semantics', () => {
    it('deleting the active bank leaves active meta pointing at gone id (caller responsibility)', async () => {
        const mod = await freshImport();
        const sha1 = '6'.repeat(40);
        await mod.writeBank(sha1, 'a', new Uint8Array([1]), 'A');
        await mod.writeBank(sha1, 'b', new Uint8Array([2]), 'B');
        await mod.setActiveBank(sha1, 'a');
        await mod.deleteBank(sha1, 'a');
        // API does not auto-reassign; UI is expected to.
        expect(await mod.getActiveBank(sha1)).toBe('a');
        expect(await mod.loadBank(sha1, 'a')).toBeUndefined();
    });
});

describe('batterySaveDb: ringHead persistence across reopens', () => {
    it('overwrites correct slot after module re-import', async () => {
        let mod = await freshImport();
        const sha1 = '7'.repeat(40);
        await mod.pushRing(sha1, new Uint8Array([1]), 'default');
        await mod.pushRing(sha1, new Uint8Array([2]), 'default');
        await mod.pushRing(sha1, new Uint8Array([3]), 'default');
        // Re-import module (fresh JS state) but keep IDB.
        mod = await import('./batterySaveDb');
        await mod.pushRing(sha1, new Uint8Array([4]), 'default');
        const ring = await mod.listRing(sha1);
        expect(ring.length).toBe(3);
        const payloads = ring.map(e => e.bytes[0]).sort();
        expect(payloads).toEqual([2, 3, 4]);
    });
});

describe('batterySaveDb: generateBankId', () => {
    it('returns distinct non-empty strings', async () => {
        const mod = await freshImport();
        const a = mod.generateBankId();
        const b = mod.generateBankId();
        expect(a.length).toBeGreaterThan(0);
        expect(b.length).toBeGreaterThan(0);
        expect(a).not.toBe(b);
    });
});
