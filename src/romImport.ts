import type { LibraryRom } from './types';
import { isZipFilename, extractRomFromZip } from './zipRom';
import { addLibraryRomFromBuffer } from 'stores/libraryStore';

export type ImportError = { name: string; reason: string };

export interface ImportReport {
    added: LibraryRom[];
    duplicates: string[];
    errors: ImportError[];
    skippedSav: string[];
}

export type ProgressCallback = (done: number, total: number) => void;

const ROM_EXT = /\.gbc?$/i;
const SAV_EXT = /\.sav$/i;

function ext(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? '';
}

async function processOne(file: File): Promise<
    | { kind: 'add'; name: string; buffer: ArrayBuffer }
    | { kind: 'sav' }
    | { kind: 'error'; reason: string }
> {
    if (SAV_EXT.test(file.name)) return { kind: 'sav' };

    if (isZipFilename(file.name)) {
        const buf = await file.arrayBuffer();
        const r = await extractRomFromZip(buf);
        if (!r.ok) {
            const reason =
                r.reason === 'no-rom' ? 'No .gb/.gbc found in archive'
                : r.reason === 'multi-rom' ? 'Multiple ROMs in archive'
                : 'Invalid or corrupt zip file';
            return { kind: 'error', reason };
        }
        const innerExt = r.innerName.match(ROM_EXT)![0];
        const stem = file.name.replace(/\.zip$/i, '');
        const ab = r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength) as ArrayBuffer;
        return { kind: 'add', name: stem + innerExt, buffer: ab };
    }

    if (ROM_EXT.test(file.name)) {
        const buf = await file.arrayBuffer();
        return { kind: 'add', name: file.name, buffer: buf };
    }

    return { kind: 'error', reason: `Unknown file type: .${ext(file.name)}` };
}

export async function importRomFiles(
    files: File[],
    onProgress?: ProgressCallback,
): Promise<ImportReport> {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
    const report: ImportReport = { added: [], duplicates: [], errors: [], skippedSav: [] };

    for (let i = 0; i < sorted.length; i++) {
        const file = sorted[i];
        try {
            const step = await processOne(file);
            if (step.kind === 'sav') {
                report.skippedSav.push(file.name);
                console.warn(`[import] skipped .sav: ${file.name} (saves not persistent yet)`);
            } else if (step.kind === 'error') {
                report.errors.push({ name: file.name, reason: step.reason });
                console.error(`[import] ${file.name}: ${step.reason}`);
            } else {
                const r = await addLibraryRomFromBuffer(step.name, step.buffer);
                if (r.status === 'added') {
                    report.added.push(r.rom);
                } else {
                    report.duplicates.push(file.name);
                    console.warn(`[import] duplicate: ${file.name} (sha1=${r.rom.sha1})`);
                }
            }
        } catch (e) {
            const reason = (e as Error)?.message ?? String(e);
            report.errors.push({ name: file.name, reason });
            console.error(`[import] ${file.name}: ${reason}`);
        }
        onProgress?.(i + 1, sorted.length);
    }

    return report;
}
