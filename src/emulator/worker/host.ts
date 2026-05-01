// Pure dispatcher: maps WorkerCommand → BackendInstance call → WorkerResponse.
// No I/O, no `self`/`postMessage` — caller injects a `send` function.
// This makes the dispatcher unit-testable in node and reusable from a real
// Worker (worker.ts) or a same-thread MessagePort.

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
                case WorkerCommandKind.Init: {
                    backend.initEmulator(command.useBootRom);
                    send({ id: command.id, kind: WorkerCommandKind.Init });
                    return;
                }
                case WorkerCommandKind.LoadBootRom: {
                    const ok = backend.loadBootRom(command.rom);
                    send({ id: command.id, kind: WorkerCommandKind.LoadBootRom, ok });
                    return;
                }
                case WorkerCommandKind.LoadCartridgeRom: {
                    const ok = backend.loadCartridgeRom(command.rom);
                    send({ id: command.id, kind: WorkerCommandKind.LoadCartridgeRom, ok });
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
                case WorkerCommandKind.SetJoypad: {
                    backend.setJoypad(command.bits);
                    send({ id: command.id, kind: WorkerCommandKind.SetJoypad });
                    return;
                }
            }
        },
    };
}
