import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LibraryRom } from './types';

vi.mock('./zipRom', () => ({
    isZipFilename: (n: string) => /\.zip$/i.test(n),
    isZipUri: () => false,
    extractRomFromZip: vi.fn(),
}));

vi.mock('stores/libraryStore', () => ({
    addLibraryRomFromBuffer: vi.fn(),
}));

async function freshImport() {
    vi.resetModules();
    return {
        importMod: await import('./romImport'),
        zipMod: await import('./zipRom'),
        libMod: await import('stores/libraryStore'),
    };
}

const mkFile = (name: string, bytes = new Uint8Array([1, 2, 3])) =>
    new File([bytes], name);

const mkRom = (name: string, sha1: string): LibraryRom => ({
    name, sha1, source: { kind: 'idb' }, fileSize: 3, addedAt: 1,
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('importRomFiles', () => {
    it('sorts files alphabetically before processing', async () => {
        const { importMod, libMod } = await freshImport();
        const order: string[] = [];
        (libMod.addLibraryRomFromBuffer as any).mockImplementation(async (name: string) => {
            order.push(name);
            return { status: 'added', rom: mkRom(name, name) };
        });
        await importMod.importRomFiles([mkFile('c.gb'), mkFile('a.gb'), mkFile('b.gb')]);
        expect(order).toEqual(['a.gb', 'b.gb', 'c.gb']);
    });

    it('categorises added vs duplicates', async () => {
        const { importMod, libMod } = await freshImport();
        (libMod.addLibraryRomFromBuffer as any).mockImplementation(async (name: string) => {
            if (name === 'dup.gb') return { status: 'duplicate', rom: mkRom(name, 'sha-dup') };
            return { status: 'added', rom: mkRom(name, 'sha-' + name) };
        });
        const report = await importMod.importRomFiles([mkFile('a.gb'), mkFile('dup.gb')]);
        expect(report.added.map(r => r.name)).toEqual(['a.gb']);
        expect(report.duplicates).toEqual(['dup.gb']);
        expect(report.errors.length).toBe(0);
    });

    it('skips .sav files into skippedSav, never calls add', async () => {
        const { importMod, libMod } = await freshImport();
        (libMod.addLibraryRomFromBuffer as any).mockResolvedValue({ status: 'added', rom: mkRom('x', 'x') });
        const report = await importMod.importRomFiles([mkFile('save.sav')]);
        expect(report.skippedSav).toEqual(['save.sav']);
        expect(libMod.addLibraryRomFromBuffer).not.toHaveBeenCalled();
    });

    it('extracts zip then forwards bytes', async () => {
        const { importMod, zipMod, libMod } = await freshImport();
        (zipMod.extractRomFromZip as any).mockResolvedValue({
            ok: true, innerName: 'inner.gb', bytes: new Uint8Array([9, 9, 9]),
        });
        (libMod.addLibraryRomFromBuffer as any).mockResolvedValue({
            status: 'added', rom: mkRom('pack.gb', 'sha-z'),
        });
        const report = await importMod.importRomFiles([mkFile('pack.zip')]);
        expect(zipMod.extractRomFromZip).toHaveBeenCalledTimes(1);
        expect(libMod.addLibraryRomFromBuffer).toHaveBeenCalledWith('pack.gb', expect.any(ArrayBuffer));
        expect(report.added.length).toBe(1);
    });

    it('records zip extract failure as error, never aborts batch', async () => {
        const { importMod, zipMod, libMod } = await freshImport();
        (zipMod.extractRomFromZip as any).mockResolvedValue({ ok: false, reason: 'no-rom' });
        (libMod.addLibraryRomFromBuffer as any).mockResolvedValue({
            status: 'added', rom: mkRom('ok.gb', 'sha-ok'),
        });
        const report = await importMod.importRomFiles([mkFile('bad.zip'), mkFile('ok.gb')]);
        expect(report.errors.length).toBe(1);
        expect(report.errors[0].name).toBe('bad.zip');
        expect(report.added.map(r => r.name)).toEqual(['ok.gb']);
    });

    it('records unknown extension as error', async () => {
        const { importMod } = await freshImport();
        const report = await importMod.importRomFiles([mkFile('mystery.xyz')]);
        expect(report.errors.length).toBe(1);
        expect(report.errors[0].name).toBe('mystery.xyz');
    });

    it('continues batch when one file throws', async () => {
        const { importMod, libMod } = await freshImport();
        (libMod.addLibraryRomFromBuffer as any).mockImplementation(async (name: string) => {
            if (name === 'boom.gb') throw new Error('disk full');
            return { status: 'added', rom: mkRom(name, 'sha-' + name) };
        });
        const report = await importMod.importRomFiles([mkFile('a.gb'), mkFile('boom.gb'), mkFile('c.gb')]);
        expect(report.added.length).toBe(2);
        expect(report.errors.length).toBe(1);
        expect(report.errors[0].name).toBe('boom.gb');
        expect(report.errors[0].reason).toMatch(/disk full/);
    });

    it('fires progress callback per file', async () => {
        const { importMod, libMod } = await freshImport();
        (libMod.addLibraryRomFromBuffer as any).mockResolvedValue({
            status: 'added', rom: mkRom('x', 'x'),
        });
        const calls: Array<[number, number]> = [];
        await importMod.importRomFiles(
            [mkFile('a.gb'), mkFile('b.gb'), mkFile('c.gb')],
            (done, total) => calls.push([done, total]),
        );
        expect(calls).toEqual([[1, 3], [2, 3], [3, 3]]);
    });
});
