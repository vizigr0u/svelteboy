import { writable, get, type Writable } from 'svelte/store';
import {
    openDB,
    libraryGetAll,
    libraryGet,
    cartRomGet,
    txAddIdbRom,
    txAddUriRom,
    txDeleteRom,
    txPromoteUriToIdb,
    txReconcileSha1,
    normalizeSha1ForUri,
} from './idbStore';
import type { LibraryRom, RemoteRomsList } from '../types';
import type { RenderModeOverride } from '../cartType';

export const libraryStore: Writable<LibraryRom[]> = writable<LibraryRom[]>([]);
export const libraryHydrated: Writable<boolean> = writable(false);

openDB().then(libraryGetAll).then(rows => {
    libraryStore.set(rows);
    libraryHydrated.set(true);
});

async function sha1HexFromBytes(buffer: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-1', buffer);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function readCgbFlagFromBuffer(buffer: ArrayBuffer): number | undefined {
    if (buffer.byteLength < 0x150) return undefined;
    return new Uint8Array(buffer, 0x143, 1)[0];
}

export function ensureCgbFlag(rom: LibraryRom, buffer: ArrayBuffer): LibraryRom {
    if (rom.cgbFlag !== undefined) return rom;
    const cgbFlag = readCgbFlagFromBuffer(buffer);
    if (cgbFlag === undefined) return rom;
    return { ...rom, cgbFlag };
}

export async function persistRomFields(rom: LibraryRom): Promise<void> {
    const db = await openDB();
    const existing = await libraryGet(db, rom.sha1);
    if (!existing) return;
    const merged: LibraryRom = { ...existing, ...rom };
    await txAddUriRom(db, merged);
    upsertLocal(merged);
}

export async function setRenderModeForRom(sha1: string, mode: RenderModeOverride): Promise<void> {
    const db = await openDB();
    const row = await libraryGet(db, sha1);
    if (!row) return;
    const updated: LibraryRom = { ...row, renderMode: mode };
    await txAddUriRom(db, updated);
    upsertLocal(updated);
}

function upsertLocal(row: LibraryRom): void {
    libraryStore.update(rows => {
        const idx = rows.findIndex(r => r.sha1 === row.sha1);
        if (idx >= 0) {
            const next = rows.slice();
            next[idx] = row;
            return next;
        }
        return [row, ...rows];
    });
}

function removeLocal(sha1: string): void {
    libraryStore.update(rows => rows.filter(r => r.sha1 !== sha1));
}

export type AddRomResult =
    | { status: 'added'; rom: LibraryRom }
    | { status: 'duplicate'; rom: LibraryRom };

export async function addLibraryRomFromBuffer(name: string, buffer: ArrayBuffer): Promise<AddRomResult> {
    const sha1 = await sha1HexFromBytes(buffer);
    const db = await openDB();
    const existing = await libraryGet(db, sha1);
    if (existing) {
        if (existing.source.kind !== 'idb') {
            const promoted: LibraryRom = {
                ...existing,
                source: { kind: 'idb' },
                fileSize: buffer.byteLength,
                originUri: existing.originUri ?? (existing.source.kind === 'uri' ? existing.source.uri : undefined),
            };
            await txPromoteUriToIdb(db, promoted, buffer);
            upsertLocal(promoted);
            return { status: 'duplicate', rom: promoted };
        }
        return { status: 'duplicate', rom: existing };
    }

    const row: LibraryRom = {
        name,
        sha1,
        source: { kind: 'idb' },
        fileSize: buffer.byteLength,
        addedAt: Date.now(),
    };
    await txAddIdbRom(db, row, buffer);
    upsertLocal(row);
    return { status: 'added', rom: row };
}

export async function addLibraryRomFromDrop(file: File): Promise<LibraryRom | undefined> {
    const buffer = await file.arrayBuffer();
    const result = await addLibraryRomFromBuffer(file.name, buffer);
    return result.rom;
}

export async function addLibraryRomFromUri(input: { sha1: string; name: string; uri: string }): Promise<LibraryRom> {
    const db = await openDB();
    const normSha1 = await normalizeSha1ForUri(input.sha1, input.uri);
    const existing = await libraryGet(db, normSha1);
    if (existing) return existing;
    const row: LibraryRom = {
        name: input.name,
        sha1: normSha1,
        source: { kind: 'uri', uri: input.uri },
        addedAt: Date.now(),
        originUri: input.uri,
    };
    await txAddUriRom(db, row);
    upsertLocal(row);
    return row;
}

export async function deleteLibraryRom(sha1: string): Promise<void> {
    const db = await openDB();
    const row = await libraryGet(db, sha1);
    const alsoIdb = !!row && row.source.kind === 'idb';
    await txDeleteRom(db, sha1, alsoIdb);
    removeLocal(sha1);
}

export async function promoteUriToIdb(sha1: string, bytes: ArrayBuffer): Promise<void> {
    const db = await openDB();
    const row = await libraryGet(db, sha1);
    if (!row) return;
    const promoted: LibraryRom = {
        ...row,
        source: { kind: 'idb' },
        fileSize: bytes.byteLength,
        originUri: row.originUri ?? (row.source.kind === 'uri' ? row.source.uri : undefined),
    };
    await txPromoteUriToIdb(db, promoted, bytes);
    upsertLocal(promoted);
}

export async function getBytesBySha1(sha1: string): Promise<ArrayBuffer | undefined> {
    const db = await openDB();
    return cartRomGet(db, sha1);
}

export async function bulkImportFromManifest(uri: string): Promise<{ added: number; skipped: number }> {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
    const list = (await res.json()) as RemoteRomsList;
    const db = await openDB();
    let added = 0, skipped = 0;
    for (const r of list.roms) {
        const fullUri = list.baseuri + r.location + '/' + r.filename;
        const normSha1 = await normalizeSha1ForUri(r.sha1, fullUri);
        const existing = await libraryGet(db, normSha1);
        if (existing) { skipped++; continue; }
        const row: LibraryRom = {
            name: r.filename,
            sha1: normSha1,
            source: { kind: 'uri', uri: fullUri },
            addedAt: Date.now(),
            originUri: fullUri,
        };
        await txAddUriRom(db, row);
        upsertLocal(row);
        added++;
    }
    return { added, skipped };
}

export async function reconcileSha1OnFirstPlay(
    stubSha1: string,
    bytes: ArrayBuffer,
    persistIdb: boolean,
): Promise<LibraryRom | undefined> {
    const db = await openDB();
    const stubRow = await libraryGet(db, stubSha1);
    if (!stubRow) return undefined;
    const realSha1 = await sha1HexFromBytes(bytes);
    if (realSha1 === stubSha1) return stubRow;

    const existingReal = await libraryGet(db, realSha1);
    const merged: LibraryRom = existingReal
        ? {
            ...existingReal,
            name: existingReal.name || stubRow.name,
            originUri: existingReal.originUri ?? stubRow.originUri ?? (stubRow.source.kind === 'uri' ? stubRow.source.uri : undefined),
        }
        : {
            ...stubRow,
            sha1: realSha1,
            source: persistIdb ? { kind: 'idb' } : stubRow.source,
            fileSize: persistIdb ? bytes.byteLength : stubRow.fileSize,
            originUri: stubRow.originUri ?? (stubRow.source.kind === 'uri' ? stubRow.source.uri : undefined),
        };

    await txReconcileSha1(db, stubSha1, merged, persistIdb && !existingReal ? bytes : undefined);
    libraryStore.update(rows => {
        const filtered = rows.filter(r => r.sha1 !== stubSha1 && r.sha1 !== realSha1);
        return [merged, ...filtered];
    });
    return merged;
}

export async function markLibraryRomPlayed(sha1: string): Promise<void> {
    const db = await openDB();
    const row = await libraryGet(db, sha1);
    if (!row) return;
    const updated: LibraryRom = { ...row, lastPlayedAt: Date.now() };
    await txAddUriRom(db, updated);
    upsertLocal(updated);
}

export async function findLibraryRomBySha1(sha1: string): Promise<LibraryRom | undefined> {
    const lower = sha1.toLowerCase();
    const rows = get(libraryStore);
    return rows.find(r => r.sha1.toLowerCase() === lower);
}

export async function findLibraryRomByName(name: string): Promise<LibraryRom | undefined> {
    const lower = name.toLowerCase();
    const rows = get(libraryStore);
    return rows.find(r => r.name.toLowerCase() === lower);
}

export async function findLibraryRomByUri(uri: string): Promise<LibraryRom | undefined> {
    const rows = get(libraryStore);
    return rows.find(r => r.source.kind === 'uri' && r.source.uri === uri);
}
