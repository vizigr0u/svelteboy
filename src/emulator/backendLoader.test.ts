import { describe, it, expect } from 'vitest';
import { loadBackend, BACKEND_INITIAL_PAGES, BACKEND_MAXIMUM_PAGES } from './backendLoader';

describe('backendLoader', () => {
    it('createSharedMemory returns shared WebAssembly.Memory sized for backend', async () => {
        const { createSharedMemory } = await import('./backendLoader');
        const mem = createSharedMemory();
        expect(mem).toBeInstanceOf(WebAssembly.Memory);
        expect(mem.buffer).toBeInstanceOf(SharedArrayBuffer);
        expect(mem.buffer.byteLength).toBe(BACKEND_INITIAL_PAGES * 65536);
    });

    it('loadBackend instantiates with provided shared memory', async () => {
        const { createSharedMemory } = await import('./backendLoader');
        const mem = createSharedMemory();
        const backend = await loadBackend(mem);
        expect(backend.memory).toBe(mem);
        expect(backend.memory.buffer).toBe(mem.buffer);
        expect(typeof backend.runEmulator).toBe('function');
        expect(typeof backend.initEmulator).toBe('function');
    });

    it('frame pointer falls inside shared buffer', async () => {
        const { createSharedMemory } = await import('./backendLoader');
        const mem = createSharedMemory();
        const backend = await loadBackend(mem);
        backend.initEmulator(false);
        const ptr = backend.getGameFramePtr();
        expect(ptr).toBeGreaterThan(0);
        expect(ptr + 160 * 144).toBeLessThan(mem.buffer.byteLength);
    });

    it('exports declared page bounds', () => {
        expect(BACKEND_INITIAL_PAGES).toBeGreaterThanOrEqual(132);
        expect(BACKEND_MAXIMUM_PAGES).toBeGreaterThanOrEqual(BACKEND_INITIAL_PAGES);
    });
});
