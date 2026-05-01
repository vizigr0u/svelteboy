// Wire protocol between main thread and the emulator worker.
//
// One worker hosts the WASM instance (B2). Main thread talks to it via a
// MessagePort: every request carries a numeric `id` so out-of-order replies
// can pair up. The worker may also push unsolicited events (logs, autosave
// availability) — those have id == 0 and a discriminating `event` field.

export const enum WorkerCommandKind {
    Init = 'init',
    LoadBootRom = 'loadBootRom',
    LoadCartridgeRom = 'loadCartridgeRom',
    RunEmulator = 'runEmulator',
    RunOneFrame = 'runOneFrame',
    SetJoypad = 'setJoypad',
}

export type WorkerCommand =
    | { id: number; kind: WorkerCommandKind.Init; useBootRom: boolean }
    | { id: number; kind: WorkerCommandKind.LoadBootRom; rom: ArrayBuffer }
    | { id: number; kind: WorkerCommandKind.LoadCartridgeRom; rom: ArrayBuffer }
    | { id: number; kind: WorkerCommandKind.RunEmulator; timeMs: number }
    | { id: number; kind: WorkerCommandKind.RunOneFrame }
    | { id: number; kind: WorkerCommandKind.SetJoypad; bits: number };

export type WorkerResponse =
    | { id: number; kind: WorkerCommandKind.Init }
    | { id: number; kind: WorkerCommandKind.LoadBootRom; ok: boolean }
    | { id: number; kind: WorkerCommandKind.LoadCartridgeRom; ok: boolean }
    | { id: number; kind: WorkerCommandKind.RunEmulator; stopReason: number; lastSaveFrame: number }
    | { id: number; kind: WorkerCommandKind.RunOneFrame; stopReason: number; lastSaveFrame: number }
    | { id: number; kind: WorkerCommandKind.SetJoypad };

export type WorkerEvent =
    | { id: 0; event: 'ready'; memoryPages: number };

export type WorkerOutbound = WorkerResponse | WorkerEvent;
