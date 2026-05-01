// Pure dispatcher: maps WorkerCommand → BackendInstance call → WorkerResponse.
// No I/O, no `self`/`postMessage` — caller injects a `send` function.
// Most backend exports are dispatched generically through `Call`; only the
// commands that need a composite reply (Bootstrap/Init/RunEmulator/RunOneFrame)
// are special-cased.

import type { BackendInstance } from '../backendLoader';
import {
    WorkerCommandKind,
    type WorkerCommand,
    type WorkerOutbound,
} from './protocol';

export interface EmulatorHost {
    dispatch(command: WorkerCommand): void;
}

export function createHost(
    backend: BackendInstance,
    send: (msg: WorkerOutbound) => void,
): EmulatorHost {
    return {
        dispatch(command: WorkerCommand): void {
            switch (command.kind) {
                case WorkerCommandKind.Bootstrap: {
                    send({
                        id: command.id,
                        kind: WorkerCommandKind.Bootstrap,
                        audioSampleRate: backend.getAudioSampleRate(),
                        audioBufferSize: backend.getAudioBuffersSize(),
                    });
                    return;
                }
                case WorkerCommandKind.Init: {
                    backend.initEmulator(command.useBootRom);
                    send({
                        id: command.id,
                        kind: WorkerCommandKind.Init,
                        gameFramePtr: backend.getGameFramePtr(),
                        cgbFramePtr: backend.getCGBGameFramePtr(),
                    });
                    return;
                }
                case WorkerCommandKind.Call: {
                    const fn = (backend as unknown as Record<string, (...a: unknown[]) => unknown>)[command.fn];
                    if (typeof fn !== 'function') {
                        throw new Error(`[host] backend has no function '${command.fn}'`);
                    }
                    const value = fn.apply(backend, command.args);
                    send({ id: command.id, kind: WorkerCommandKind.Call, value });
                    return;
                }
                case WorkerCommandKind.RunEmulator: {
                    const stopReason = backend.runEmulator(command.timeMs);
                    const lastSaveFrame = backend.getLastSaveFrame();
                    send({ id: command.id, kind: WorkerCommandKind.RunEmulator, stopReason, lastSaveFrame });
                    return;
                }
                case WorkerCommandKind.RunOneFrame: {
                    const stopReason = backend.runOneFrame();
                    const lastSaveFrame = backend.getLastSaveFrame();
                    send({ id: command.id, kind: WorkerCommandKind.RunOneFrame, stopReason, lastSaveFrame });
                    return;
                }
            }
        },
    };
}
