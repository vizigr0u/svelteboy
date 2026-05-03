import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { extractRomFromZip, isZipFilename, isZipUri } from './zipRom';

const fakeRom = (label: string, size = 32) => {
  const u = new Uint8Array(size);
  for (let i = 0; i < label.length && i < size; i++) u[i] = label.charCodeAt(i);
  return u;
};

const buildZip = (files: Record<string, Uint8Array>): ArrayBuffer => {
  const out = zipSync(files);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
};

describe('isZipFilename', () => {
  it('matches .zip case-insensitive', () => {
    expect(isZipFilename('foo.zip')).toBe(true);
    expect(isZipFilename('Foo.ZIP')).toBe(true);
    expect(isZipFilename('foo.gb')).toBe(false);
    expect(isZipFilename('foo.zip.gb')).toBe(false);
  });
});

describe('isZipUri', () => {
  it('strips query string', () => {
    expect(isZipUri('https://x/foo.zip?token=abc')).toBe(true);
    expect(isZipUri('https://x/foo.gb?token=abc')).toBe(false);
  });
});

describe('extractRomFromZip', () => {
  it('extracts single .gb', async () => {
    const buf = buildZip({ 'tetris.gb': fakeRom('tetris') });
    const r = await extractRomFromZip(buf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.innerName).toBe('tetris.gb');
      expect(r.bytes.byteLength).toBe(32);
    }
  });

  it('extracts single .gbc', async () => {
    const buf = buildZip({ 'oracle.gbc': fakeRom('oracle') });
    const r = await extractRomFromZip(buf);
    expect(r.ok).toBe(true);
  });

  it('accepts .gb alongside non-rom files', async () => {
    const buf = buildZip({
      'rom.gb': fakeRom('rom'),
      'readme.txt': strToU8('hello'),
      'cover.jpg': fakeRom('jpg'),
    });
    const r = await extractRomFromZip(buf);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.innerName).toBe('rom.gb');
  });

  it('rejects when no rom present', async () => {
    const buf = buildZip({ 'readme.txt': strToU8('hi') });
    const r = await extractRomFromZip(buf);
    expect(r).toEqual({ ok: false, reason: 'no-rom' });
  });

  it('rejects multi-rom zips', async () => {
    const buf = buildZip({ 'a.gb': fakeRom('a'), 'b.gb': fakeRom('b') });
    const r = await extractRomFromZip(buf);
    expect(r).toEqual({ ok: false, reason: 'multi-rom' });
  });

  it('filters __MACOSX entries', async () => {
    const buf = buildZip({
      'rom.gb': fakeRom('rom'),
      '__MACOSX/._rom.gb': fakeRom('mac'),
    });
    const r = await extractRomFromZip(buf);
    expect(r.ok).toBe(true);
  });

  it('returns invalid on garbage', async () => {
    const buf = new Uint8Array([0, 1, 2, 3, 4]).buffer;
    const r = await extractRomFromZip(buf);
    expect(r).toEqual({ ok: false, reason: 'invalid' });
  });
});
