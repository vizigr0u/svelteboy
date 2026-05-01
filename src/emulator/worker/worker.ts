// Web Worker entry: waits for a Bootstrap command from the main thread that
// supplies the shared WebAssembly.Memory, then instantiates the backend on it
// and routes subsequent WorkerCommands through createHost. Imported as a
// module worker (Vite resolves the new URL(...) into a bundled chunk).

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
        ctx.postMessage({ id: cmd.id, kind: WorkerCommandKind.Bootstrap } as WorkerOutbound);
        ctx.postMessage({ id: 0, event: 'ready', memoryPages: cmd.memory.buffer.byteLength / 65536 } as WorkerOutbound);
        for (const queued of pendingCommands) host.dispatch(queued);
        pendingCommands.length = 0;
        return;
    }
    pendingCommands.push(cmd);
};

export type { };
