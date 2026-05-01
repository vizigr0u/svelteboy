import { describe, it, expect, beforeAll } from 'vitest';
import { createSharedMemory, loadBackend, type BackendInstance } from '../backendLoader';
import { createHost, type EmulatorHost } from './host';
import { WorkerCommandKind, type WorkerCommand, type WorkerOutbound } from './protocol';

let backend: BackendInstance;
let memory: WebAssembly.Memory;
let host: EmulatorHost;
const sent: WorkerOutbound[] = [];

beforeAll(async () => {
    memory = createSharedMemory();
    backend = await loadBackend(memory);
    host = createHost(backend, msg => sent.push(msg));
});

describe('emulator worker host', () => {
    it('Init responds with same id', () => {
        const cmd: WorkerCommand = { id: 1, kind: WorkerCommandKind.Init, useBootRom: false };
        host.dispatch(cmd);
        const reply = sent.find(m => 'id' in m && m.id === 1) as Extract<WorkerOutbound, { id: number }>;
        expect(reply).toBeDefined();
        expect((reply as { kind: WorkerCommandKind }).kind).toBe(WorkerCommandKind.Init);
    });

    it('LoadCartridgeRom returns ok=true for nop rom', () => {
        const rom = new Uint8Array(0x8000);
        rom[0x143] = 0; // DMG flag
        const cmd: WorkerCommand = { id: 2, kind: WorkerCommandKind.LoadCartridgeRom, rom: rom.buffer };
        host.dispatch(cmd);
        const reply = sent.find(m => 'id' in m && m.id === 2) as Extract<WorkerOutbound, { kind: WorkerCommandKind.LoadCartridgeRom }>;
        expect(reply).toBeDefined();
        expect(reply.ok).toBe(true);
    });

    it('SetJoypad acks', () => {
        host.dispatch({ id: 3, kind: WorkerCommandKind.SetJoypad, bits: 0xFF });
        const reply = sent.find(m => 'id' in m && m.id === 3);
        expect(reply).toBeDefined();
        expect((reply as { kind: WorkerCommandKind }).kind).toBe(WorkerCommandKind.SetJoypad);
    });

    it('RunEmulator returns numeric stopReason', () => {
        host.dispatch({ id: 4, kind: WorkerCommandKind.Init, useBootRom: false });
        host.dispatch({ id: 5, kind: WorkerCommandKind.RunEmulator, timeMs: 16.7 });
        const reply = sent.find(m => 'id' in m && m.id === 5) as Extract<WorkerOutbound, { kind: WorkerCommandKind.RunEmulator }>;
        expect(reply).toBeDefined();
        expect(typeof reply.stopReason).toBe('number');
        expect(typeof reply.lastSaveFrame).toBe('number');
    });
});
