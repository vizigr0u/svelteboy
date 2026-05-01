// Main-thread façade for the emulator worker.
// Wraps a MessagePort-like transport so it works both with a real Web Worker
// (port = the Worker itself) and with node:worker_threads MessageChannel
// (proxy.test.ts uses this for in-process integration tests).

import {
    WorkerCommandKind,
    type WorkerCommand,
    type WorkerOutbound,
    type WorkerResponse,
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
    bootstrap(memory: WebAssembly.Memory): Promise<void>;
    init(useBootRom: boolean): Promise<void>;
    loadBootRom(rom: ArrayBuffer): Promise<boolean>;
    loadCartridgeRom(rom: ArrayBuffer): Promise<boolean>;
    runEmulator(timeMs: number): Promise<RunResult>;
    runOneFrame(): Promise<RunResult>;
    setJoypad(bits: number): Promise<void>;
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
        async bootstrap(memory: WebAssembly.Memory): Promise<void> {
            await send({ kind: WorkerCommandKind.Bootstrap, memory });
        },
        async init(useBootRom: boolean): Promise<void> {
            await send({ kind: WorkerCommandKind.Init, useBootRom });
        },
        async loadBootRom(rom: ArrayBuffer): Promise<boolean> {
            const r = await send<Extract<WorkerResponse, { kind: WorkerCommandKind.LoadBootRom }>>(
                { kind: WorkerCommandKind.LoadBootRom, rom }
            );
            return r.ok;
        },
        async loadCartridgeRom(rom: ArrayBuffer): Promise<boolean> {
            const r = await send<Extract<WorkerResponse, { kind: WorkerCommandKind.LoadCartridgeRom }>>(
                { kind: WorkerCommandKind.LoadCartridgeRom, rom }
            );
            return r.ok;
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
        async setJoypad(bits: number): Promise<void> {
            await send({ kind: WorkerCommandKind.SetJoypad, bits });
        },
        dispose(): void {
            removeListener();
            pending.clear();
        },
    };
}
