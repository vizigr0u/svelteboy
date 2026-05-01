// Wire protocol between main thread and the emulator worker.
//
// One worker hosts the WASM instance. Main thread talks to it via a
// MessagePort: every request carries a numeric `id` so out-of-order replies
// can pair up. The worker may also push unsolicited events — those have id == 0
// and a discriminating `event` field.
//
// Most backend functions are routed through a single generic `Call` command:
// the worker reflectively invokes `backend[fn](...args)` and returns the
// value. Special-cased kinds:
//   Bootstrap — carries the shared memory + reports stable post-instantiate
//               metadata (audio sample rate / buffer size).
//   Init      — runs initEmulator + reports frame buffer pointers, which are
//               only valid after Ppu.Init runs.
//   RunEmulator / RunOneFrame — return composite stopReason+lastSaveFrame so
//               the run loop avoids a second round-trip per frame.

export const enum WorkerCommandKind {
    Bootstrap = 'bootstrap',
    Init = 'init',
    Call = 'call',
    RunEmulator = 'runEmulator',
    RunOneFrame = 'runOneFrame',
}

export type WorkerCommand =
    | { id: number; kind: WorkerCommandKind.Bootstrap; memory: WebAssembly.Memory }
    | { id: number; kind: WorkerCommandKind.Init; useBootRom: boolean }
    | { id: number; kind: WorkerCommandKind.Call; fn: string; args: unknown[] }
    | { id: number; kind: WorkerCommandKind.RunEmulator; timeMs: number }
    | { id: number; kind: WorkerCommandKind.RunOneFrame };

export interface BackendAddresses {
    gameFramePtr: number;
    cgbFramePtr: number;
}

export interface BackendStaticInfo {
    audioSampleRate: number;
    audioBufferSize: number;
}

export type WorkerResponse =
    | ({ id: number; kind: WorkerCommandKind.Bootstrap } & BackendStaticInfo)
    | ({ id: number; kind: WorkerCommandKind.Init } & BackendAddresses)
    | { id: number; kind: WorkerCommandKind.Call; value: unknown }
    | { id: number; kind: WorkerCommandKind.RunEmulator; stopReason: number; lastSaveFrame: number }
    | { id: number; kind: WorkerCommandKind.RunOneFrame; stopReason: number; lastSaveFrame: number };

export type WorkerEvent =
    | { id: 0; event: 'ready' };

export type WorkerOutbound = WorkerResponse | WorkerEvent;
