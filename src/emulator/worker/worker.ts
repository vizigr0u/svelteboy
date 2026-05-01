// Web Worker entry: waits for the first Bootstrap command (which carries the
// shared WebAssembly.Memory), instantiates the AS backend on it, then routes
// every subsequent WorkerCommand — including the Bootstrap reply itself —
// through createHost. Imported as a module worker (Vite resolves the
// new URL(...) into a bundled chunk).

/// <reference lib="webworker" />

import { loadBackend } from '../backendLoader';
import { createHost, type EmulatorHost } from './host';
import { WorkerCommandKind, type WorkerCommand, type WorkerOutbound } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let host: EmulatorHost | null = null;
const pendingCommands: WorkerCommand[] = [];

ctx.onmessage = async (e) => {
    const cmd = e.data as WorkerCommand;
    if (host) {
        host.dispatch(cmd);
        return;
    }
    if (cmd.kind === WorkerCommandKind.Bootstrap) {
        const backend = await loadBackend(cmd.memory);
        host = createHost(backend, (msg: WorkerOutbound) => ctx.postMessage(msg));
        // Let the host produce the Bootstrap reply (audio info).
        host.dispatch(cmd);
        ctx.postMessage({ id: 0, event: 'ready' } satisfies WorkerOutbound);
        for (const queued of pendingCommands) host.dispatch(queued);
        pendingCommands.length = 0;
        return;
    }
    pendingCommands.push(cmd);
};

export type { };
