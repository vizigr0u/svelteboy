import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

async function freshImport() {
    vi.resetModules();
    return await import('./batterySaveDb');
}

beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
});

describe('batterySaveDb', () => {
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

    it('overwrites existing battery save', async () => {
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
