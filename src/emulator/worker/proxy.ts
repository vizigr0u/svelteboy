// Main-thread façade for the emulator worker.
// Wraps a MessagePort-like transport so it works both with a real Web Worker
// (port = the Worker itself) and with node:worker_threads MessageChannel
// (proxy.test.ts uses this for in-process integration tests).

import {
    WorkerCommandKind,
    type WorkerCommand,
    type WorkerOutbound,
    type WorkerResponse,
    type BackendAddresses,
    type BackendStaticInfo,
} from './protocol';

export interface ProxyTransport {
    postMessage(msg: WorkerCommand): void;
    addMessageListener(cb: (msg: WorkerOutbound) => void): () => void;
}

export interface RunResult {
    stopReason: number;
    lastSaveFrame: number;
}

export interface EmulatorProxy {
    bootstrap(memory: WebAssembly.Memory): Promise<BackendStaticInfo>;
    init(useBootRom: boolean): Promise<BackendAddresses>;
    runEmulator(timeMs: number): Promise<RunResult>;
    runOneFrame(): Promise<RunResult>;
    /** Generic backend call. Use the typed helpers below in preference. */
    call<R = unknown>(fn: string, args?: unknown[]): Promise<R>;
    dispose(): void;
}

type Pending = (msg: WorkerResponse) => void;
type CommandWithoutId = { [K in WorkerCommand['kind']]: Omit<Extract<WorkerCommand, { kind: K }>, 'id'> }[WorkerCommand['kind']];

export function createProxy(transport: ProxyTransport): EmulatorProxy {
    const pending = new Map<number, Pending>();
    let nextId = 1;

    const removeListener = transport.addMessageListener((msg) => {
        if ('event' in msg) return; // unsolicited events handled elsewhere later
        const resolver = pending.get(msg.id);
        if (resolver) {
            pending.delete(msg.id);
            resolver(msg as WorkerResponse);
        }
    });

    function send<R extends WorkerResponse>(cmd: CommandWithoutId): Promise<R> {
        const id = nextId++;
        const full = { ...(cmd as object), id } as WorkerCommand;
        return new Promise<R>((resolve) => {
            pending.set(id, (msg) => resolve(msg as R));
            transport.postMessage(full);
        });
    }

    return {
        async bootstrap(memory: WebAssembly.Memory): Promise<BackendStaticInfo> {
            const r = await send<Extract<WorkerResponse, { kind: WorkerCommandKind.Bootstrap }>>(
                { kind: WorkerCommandKind.Bootstrap, memory }
            );
            return { audioSampleRate: r.audioSampleRate, audioBufferSize: r.audioBufferSize };
        },
        async init(useBootRom: boolean): Promise<BackendAddresses> {
            const r = await send<Extract<WorkerResponse, { kind: WorkerCommandKind.Init }>>(
                { kind: WorkerCommandKind.Init, useBootRom }
            );
            return { gameFramePtr: r.gameFramePtr, cgbFramePtr: r.cgbFramePtr };
        },
        async runEmulator(timeMs: number): Promise<RunResult> {
            const r = await send<Extract<WorkerResponse, { kind: WorkerCommandKind.RunEmulator }>>(
                { kind: WorkerCommandKind.RunEmulator, timeMs }
            );
            return { stopReason: r.stopReason, lastSaveFrame: r.lastSaveFrame };
        },
        async runOneFrame(): Promise<RunResult> {
            const r = await send<Extract<WorkerResponse, { kind: WorkerCommandKind.RunOneFrame }>>(
                { kind: WorkerCommandKind.RunOneFrame }
            );
            return { stopReason: r.stopReason, lastSaveFrame: r.lastSaveFrame };
        },
        async call<R = unknown>(fn: string, args: unknown[] = []): Promise<R> {
            const r = await send<Extract<WorkerResponse, { kind: WorkerCommandKind.Call }>>(
                { kind: WorkerCommandKind.Call, fn, args }
            );
            return r.value as R;
        },
        dispose(): void {
            removeListener();
            pending.clear();
        },
    };
}
