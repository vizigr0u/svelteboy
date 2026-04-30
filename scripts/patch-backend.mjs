// Post-process build/backend.js so JS controls instantiation.
//
// AssemblyScript's ESM bindings emit a top-level-await self-instantiating module:
//   export const { memory, ... } = await (async url => instantiate(...))(new URL(...));
//
// This forbids passing custom imports (notably a JS-provided shared WebAssembly.Memory).
// We rewrite that tail into a `loadBackendInstance(imports)` async export and reuse the
// existing `instantiate(module, imports)` inner function (which already supports
// `imports.env.memory` fallback).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', 'build', 'backend.js');

const ALREADY_PATCHED_MARK = '__svelteboyBackendPatched__';

const TAIL_PATTERN = /export const \{[\s\S]+?\} = await \(async url => instantiate\([\s\S]+?\)\)\(new URL\("backend\.wasm",\s*import\.meta\.url\)\);\s*$/m;

const REPLACEMENT = `// ${ALREADY_PATCHED_MARK}
async function __compileBackendModule(url = new URL("backend.wasm", import.meta.url)) {
  const isNodeOrBun = typeof process != "undefined" && process.versions != null && (process.versions.node != null || process.versions.bun != null);
  if (isNodeOrBun) {
    return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url));
  }
  return globalThis.WebAssembly.compileStreaming(globalThis.fetch(url));
}

export async function loadBackendInstance(imports = {}) {
  const module = await __compileBackendModule();
  return instantiate(module, imports);
}
`;

function patch() {
    const src = readFileSync(target, 'utf8');
    if (src.includes(ALREADY_PATCHED_MARK)) {
        return;
    }
    if (!TAIL_PATTERN.test(src)) {
        throw new Error(
            `[patch-backend] anchor not found in ${target}. ` +
            `AssemblyScript binding format may have changed; update TAIL_PATTERN/REPLACEMENT.`
        );
    }
    const out = src.replace(TAIL_PATTERN, REPLACEMENT);
    writeFileSync(target, out);
}

patch();
