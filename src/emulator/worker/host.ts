// Pure dispatcher: maps WorkerCommand → BackendInstance call → WorkerResponse.
// No I/O, no `self`/`postMessage` — caller injects a `send` function.
// Most backend exports are dispatched generically through `Call`; only the
// commands that need a composite reply (Bootstrap/Init/RunEmulator/RunOneFrame)
// are special-cased.

import type { BackendInstance } from '../backendLoader';
import { SabWriter } from '../../audio/sabRingBuffer';
import {
    WorkerCommandKind,
    type WorkerCommand,
    type WorkerOutbound,
} from './protocol';

export interface EmulatorHost {
    dispatch(command: WorkerCommand): void;
}

// Target SAB occupancy. Excess WASM buffers are dropped here (keeping wall-clock
// pace) instead of at the SAB via drop-oldest (which sounds like fast-forward).
const SAB_TARGET_FRAMES = 4096; // ~93 ms

export function createHost(
    backend: BackendInstance,
    send: (msg: WorkerOutbound) => void,
): EmulatorHost {
    const memoryBuffer = () => backend.memory.buffer as ArrayBuffer;
    let audioWriter: SabWriter | null = null;
    let audioBufferSize = 0;

    function drainAudioToSab(): void {
        if (!audioWriter) {
            // Caller didn't attach an audio SAB — drop everything to keep ring live.
            const n = backend.getAudioBuffersToReadCount();
            if (n > 0) backend.markAudioBuffersRead(n);
            return;
        }
        const numAvailable = backend.getAudioBuffersToReadCount();
        if (numAvailable === 0) return;
        const occupancy = audioWriter.availableRead();
        const headroom = Math.max(0, SAB_TARGET_FRAMES - occupancy);
        const buffersToWrite = Math.min(numAvailable, Math.ceil(headroom / audioBufferSize));
        const toDrain = numAvailable - buffersToWrite;
        if (toDrain > 0) backend.markAudioBuffersRead(toDrain);
        if (buffersToWrite === 0) return;
        for (let i = 0; i < buffersToWrite; i++) {
            const leftPtr = backend.getAudioBufferToReadPointer(0);
            const rightPtr = backend.getAudioBufferToReadPointer(1);
            const left = new Float32Array(memoryBuffer(), leftPtr, audioBufferSize);
            const right = new Float32Array(memoryBuffer(), rightPtr, audioBufferSize);
            audioWriter.write(left, right);
            backend.markAudioBuffersRead(1);
        }
    }

    return {
        dispatch(command: WorkerCommand): void {
            switch (command.kind) {
                case WorkerCommandKind.Bootstrap: {
                    audioBufferSize = backend.getAudioBuffersSize();
                    audioWriter = new SabWriter(command.audioSab, command.audioCapacity);
                    send({
                        id: command.id,
                        kind: WorkerCommandKind.Bootstrap,
                        audioSampleRate: backend.getAudioSampleRate(),
                        audioBufferSize,
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
                    backend.setJoypad(command.joypad);
                    const stopReason = backend.runEmulator(command.timeMs);
                    drainAudioToSab();
                    const lastSaveFrame = backend.getLastSaveFrame();
                    const logs = command.maxLogLines > 0 ? backend.spliceLogs(command.maxLogLines) : [];
                    send({ id: command.id, kind: WorkerCommandKind.RunEmulator, stopReason, lastSaveFrame, logs });
                    return;
                }
                case WorkerCommandKind.RunOneFrame: {
                    backend.setJoypad(command.joypad);
                    const stopReason = backend.runOneFrame();
                    drainAudioToSab();
                    const lastSaveFrame = backend.getLastSaveFrame();
                    const logs = command.maxLogLines > 0 ? backend.spliceLogs(command.maxLogLines) : [];
                    send({ id: command.id, kind: WorkerCommandKind.RunOneFrame, stopReason, lastSaveFrame, logs });
                    return;
                }
            }
        },
    };
}
