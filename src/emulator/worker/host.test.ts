import { describe, it, expect, beforeAll } from 'vitest';
import { createSharedMemory, loadBackend, type BackendInstance } from '../backendLoader';
import { createHost, type EmulatorHost } from './host';
import { WorkerCommandKind, type WorkerCommand, type WorkerOutbound, type WorkerResponse } from './protocol';

let backend: BackendInstance;
let memory: WebAssembly.Memory;
let host: EmulatorHost;
const sent: WorkerOutbound[] = [];

beforeAll(async () => {
    memory = createSharedMemory();
    backend = await loadBackend(memory);
    host = createHost(backend, msg => sent.push(msg));
});

function dispatch(cmd: WorkerCommand): WorkerResponse {
    sent.length = 0;
    host.dispatch(cmd);
    expect(sent.length).toBe(1);
    const m = sent[0];
    if ('event' in m) throw new Error('expected response, got event');
    return m;
}

describe('emulator worker host', () => {
    it('Bootstrap reports audio sample rate + buffer size', () => {
        const reply = dispatch({ id: 1, kind: WorkerCommandKind.Bootstrap, memory });
        if (reply.kind !== WorkerCommandKind.Bootstrap) throw new Error('wrong kind');
        expect(reply.audioSampleRate).toBeGreaterThan(0);
        expect(reply.audioBufferSize).toBeGreaterThan(0);
    });

    it('Init returns frame ptrs', () => {
        const reply = dispatch({ id: 2, kind: WorkerCommandKind.Init, useBootRom: false });
        if (reply.kind !== WorkerCommandKind.Init) throw new Error('wrong kind');
        expect(reply.gameFramePtr).toBeGreaterThan(0);
        expect(reply.cgbFramePtr).toBeGreaterThan(0);
    });

    it('Call dispatches by name and returns value', () => {
        const reply = dispatch({ id: 3, kind: WorkerCommandKind.Call, fn: 'isCgbMode', args: [] });
        if (reply.kind !== WorkerCommandKind.Call) throw new Error('wrong kind');
        expect(typeof reply.value).toBe('boolean');
    });

    it('Call setJoypad has no return', () => {
        const reply = dispatch({ id: 4, kind: WorkerCommandKind.Call, fn: 'setJoypad', args: [0xFF] });
        if (reply.kind !== WorkerCommandKind.Call) throw new Error('wrong kind');
        expect(reply.value).toBeUndefined();
    });

    it('Call loadCartridgeRom returns ok=true for nop rom', () => {
        const rom = new ArrayBuffer(0x8000);
        const reply = dispatch({ id: 5, kind: WorkerCommandKind.Call, fn: 'loadCartridgeRom', args: [rom] });
        if (reply.kind !== WorkerCommandKind.Call) throw new Error('wrong kind');
        expect(reply.value).toBe(true);
    });

    it('Call unknown fn throws', () => {
        expect(() => host.dispatch({ id: 6, kind: WorkerCommandKind.Call, fn: 'doesNotExist', args: [] }))
            .toThrowError(/no function 'doesNotExist'/);
    });

    it('RunEmulator returns numeric stopReason + lastSaveFrame', () => {
        host.dispatch({ id: 7, kind: WorkerCommandKind.Init, useBootRom: false });
        const reply = dispatch({ id: 8, kind: WorkerCommandKind.RunEmulator, timeMs: 16.7, joypad: 0, maxLogLines: 0 });
        if (reply.kind !== WorkerCommandKind.RunEmulator) throw new Error('wrong kind');
        expect(typeof reply.stopReason).toBe('number');
        expect(typeof reply.lastSaveFrame).toBe('number');
    });
});
