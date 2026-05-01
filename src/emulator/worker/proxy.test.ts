import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MessageChannel } from 'node:worker_threads';
import { createSharedMemory, loadBackend, type BackendInstance } from '../backendLoader';
import { createHost, type EmulatorHost } from './host';
import { createProxy, type EmulatorProxy } from './proxy';
import type { WorkerCommand, WorkerOutbound } from './protocol';

let proxy: EmulatorProxy;
let backend: BackendInstance;
let memory: WebAssembly.Memory;
let channel: MessageChannel;

// Mirrors worker.ts's two-stage bootstrap (waits for the Bootstrap command,
// then attaches the host) but runs in the same node process so we can drive
// it from vitest without spawning a real Worker.
beforeAll(async () => {
    memory = createSharedMemory();
    backend = await loadBackend(memory);

    channel = new MessageChannel();
    const hostPort = channel.port1;
    const proxyPort = channel.port2;

    let host: EmulatorHost | null = null;
    hostPort.on('message', (m: WorkerCommand) => {
        if (!host) host = createHost(backend, msg => hostPort.postMessage(msg));
        host.dispatch(m);
    });

    proxy = createProxy({
        postMessage: (msg) => proxyPort.postMessage(msg),
        addMessageListener: (cb) => {
            const listener = (m: WorkerOutbound) => cb(m);
            proxyPort.on('message', listener);
            return () => proxyPort.off('message', listener);
        },
    });

    await proxy.bootstrap(memory);
});

afterAll(() => {
    channel.port1.close();
    channel.port2.close();
});

describe('emulator worker proxy', () => {
    it('bootstrap returns audio static info', async () => {
        // bootstrap was awaited in beforeAll; re-issue to inspect shape
        const info = await proxy.bootstrap(memory);
        expect(info.audioSampleRate).toBeGreaterThan(0);
        expect(info.audioBufferSize).toBeGreaterThan(0);
    });

    it('init returns frame pointers', async () => {
        const addr = await proxy.init(false);
        expect(addr.gameFramePtr).toBeGreaterThan(0);
        expect(addr.cgbFramePtr).toBeGreaterThan(0);
    });

    it('call(loadCartridgeRom) round-trips ok=true', async () => {
        const ok = await proxy.call<boolean>('loadCartridgeRom', [new ArrayBuffer(0x8000)]);
        expect(ok).toBe(true);
    });

    it('runEmulator returns numeric stop reason', async () => {
        await proxy.init(false);
        const result = await proxy.runEmulator(16.7);
        expect(typeof result.stopReason).toBe('number');
        expect(typeof result.lastSaveFrame).toBe('number');
    });

    it('parallel commands resolve to their own replies (id pairing)', async () => {
        const [r1, r2] = await Promise.all([
            proxy.runEmulator(1),
            proxy.runEmulator(1),
        ]);
        expect(typeof r1.stopReason).toBe('number');
        expect(typeof r2.stopReason).toBe('number');
    });

    it('call(setJoypad) resolves to undefined', async () => {
        const v = await proxy.call('setJoypad', [0xFF]);
        expect(v).toBeUndefined();
    });

    it('call(isCgbMode) returns boolean', async () => {
        const v = await proxy.call<boolean>('isCgbMode');
        expect(typeof v).toBe('boolean');
    });
});
