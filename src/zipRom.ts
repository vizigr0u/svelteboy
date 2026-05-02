export type ExtractResult =
  | { ok: true; bytes: Uint8Array; innerName: string }
  | { ok: false; reason: 'no-rom' | 'multi-rom' | 'invalid' };

export function isZipFilename(name: string): boolean {
  return /\.zip$/i.test(name);
}

export function isZipUri(uri: string): boolean {
  try {
    return /\.zip$/i.test(new URL(uri).pathname);
  } catch {
    return /\.zip(?:[?#]|$)/i.test(uri);
  }
}

const ROM_RE = /\.gbc?$/i;
const SKIP_RE = /(^|\/)(__MACOSX|\._|\.DS_Store)/;

export async function extractRomFromZip(buffer: ArrayBuffer): Promise<ExtractResult> {
  let unzipSync: typeof import('fflate').unzipSync;
  try {
    ({ unzipSync } = await import('fflate'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const roms = Object.entries(entries).filter(
    ([name, data]) => !SKIP_RE.test(name) && ROM_RE.test(name) && data.byteLength > 0
  );
  if (roms.length === 0) return { ok: false, reason: 'no-rom' };
  if (roms.length > 1) return { ok: false, reason: 'multi-rom' };
  const [innerName, bytes] = roms[0];
  return { ok: true, bytes, innerName };
}
