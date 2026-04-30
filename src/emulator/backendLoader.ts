// Loads the AssemblyScript backend with a JS-provided shared WebAssembly.Memory.
// asconfig.json sets --importMemory --sharedMemory --initialMemory N --maximumMemory M;
// scripts/patch-backend.mjs rewrites the AS-generated bindings so we can pass our own
// `imports.env.memory` instead of WASM allocating its own.

// @ts-ignore — patched export, not in AS-generated .d.ts.
import { loadBackendInstance } from '../../build/backend';

export const BACKEND_INITIAL_PAGES = 256;  // 16 MiB — covers manual GB region (~132 pages) + AS static + heap.
export const BACKEND_MAXIMUM_PAGES = 1024; // 64 MiB upper bound.
const PAGE_BYTES = 65536;

export type BackendInstance = Awaited<ReturnType<typeof loadBackendInstance>>;

export function createSharedMemory(): WebAssembly.Memory {
    return new WebAssembly.Memory({
        initial: BACKEND_INITIAL_PAGES,
        maximum: BACKEND_MAXIMUM_PAGES,
        shared: true,
    });
}

export async function loadBackend(memory: WebAssembly.Memory): Promise<BackendInstance> {
    if (!(memory.buffer instanceof SharedArrayBuffer)) {
        throw new Error('[backendLoader] expected shared WebAssembly.Memory');
    }
    return loadBackendInstance({ env: { memory } });
}

void PAGE_BYTES;
