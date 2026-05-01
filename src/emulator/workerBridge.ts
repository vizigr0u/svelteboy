// Spawns the emulator worker and returns its EmulatorProxy.
// Reuses the shared WebAssembly.Memory created in wasmBridge.ts so both the
// main-thread (legacy synchronous) instance and the worker instance see the
// same memory. Concurrency contract: the run loop awaits the worker between
// frames; main-thread WASM calls (audio post-run, getDebugInfo, …) happen
// only while the worker is idle. Subsequent phases (B5, B6) will move the
// remaining call sites into the worker so this overlap goes away.

import { memory as sharedMemory } from './wasmBridge';
import { createProxy, type EmulatorProxy, type ProxyTransport } from './worker/proxy';
import type { WorkerCommand, WorkerOutbound } from './worker/protocol';

let proxyPromise: Promise<EmulatorProxy> | null = null;

function makeTransport(worker: Worker): ProxyTransport {
    return {
        postMessage: (msg: WorkerCommand) => worker.postMessage(msg),
        addMessageListener: (cb) => {
            const listener = (e: MessageEvent<WorkerOutbound>) => cb(e.data);
            worker.addEventListener('message', listener as EventListener);
            return () => worker.removeEventListener('message', listener as EventListener);
        },
    };
}

async function spawn(): Promise<EmulatorProxy> {
    const worker = new Worker(new URL('./worker/worker.ts', import.meta.url), {
        type: 'module',
        name: 'svelteboy-emulator',
    });
    const proxy = createProxy(makeTransport(worker));
    await proxy.bootstrap(sharedMemory);
    return proxy;
}

export function getEmulatorProxy(): Promise<EmulatorProxy> {
    if (!proxyPromise) proxyPromise = spawn();
    return proxyPromise;
}
