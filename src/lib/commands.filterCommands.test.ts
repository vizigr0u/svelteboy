import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writable } from 'svelte/store';

const loadedCartridge = writable<any>(null);
const loadedBootRom = writable<any>(null);
const playViewActive = writable(false);
const EmulatorPaused = writable(false);
const FastForwardActive = writable(false);
const DebuggerAttached = writable(false);
const debugUnlocked = writable(false);
const showFrametimeHistogram = writable(false);

vi.mock('../emulator', () => ({
    Emulator: { Reset: () => {}, QuickSave: () => {}, QuickLoad: () => {} },
    Debug: { RunFrame: () => {}, AttachDebugger: () => {}, DetachDebugger: () => {}, Step: () => {} },
}));
vi.mock('../emulator/lifecycle', () => ({ pauseEmulator: () => {}, unPauseEmulator: () => {} }));
vi.mock('../stores/viewStore', () => ({ goToHome: () => {}, goToPlay: () => {}, playViewActive }));
vi.mock('../stores/romStores', () => ({ loadedCartridge, loadedBootRom }));
vi.mock('../stores/playStores', () => ({ EmulatorPaused, FastForwardActive }));
vi.mock('../stores/playUiStore', () => ({ openDrawer: () => {} }));
vi.mock('../stores/optionsStore', () => ({ showFrametimeHistogram }));
vi.mock('../stores/debugStores', () => ({ DebuggerAttached }));
vi.mock('../stores/paletteStore', () => ({ debugUnlocked }));
vi.mock('../stores/hudStore', () => ({
    toggleHudChip: () => {}, enableSpeedrunHud: () => {},
}));

const { filterCommands, ALL_COMMANDS } = await import('./commands');

beforeEach(() => {
    loadedCartridge.set(null);
    loadedBootRom.set(null);
    playViewActive.set(false);
    EmulatorPaused.set(false);
    DebuggerAttached.set(false);
    debugUnlocked.set(false);
});

describe('filterCommands', () => {
    it('empty query returns all available commands with score 0', () => {
        const result = filterCommands('');
        const availableCount = ALL_COMMANDS.filter(c => c.available()).length;
        expect(result.length).toBe(availableCount);
        expect(result.every(r => r.score === 0)).toBe(true);
    });

    it('query with no match returns empty', () => {
        expect(filterCommands('zzzzzzqqqxxx')).toEqual([]);
    });

    it('matching query returns results sorted desc by score', () => {
        const result = filterCommands('open');
        expect(result.length).toBeGreaterThan(0);
        for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
        }
    });

    it('filters out unavailable commands', () => {
        // No ROM loaded → play.toggle unavailable
        const withoutRom = filterCommands('');
        expect(withoutRom.find(r => r.cmd.id === 'play.toggle')).toBeUndefined();

        loadedCartridge.set({ name: 'test.gb' });
        const withRom = filterCommands('');
        expect(withRom.find(r => r.cmd.id === 'play.toggle')).toBeDefined();
    });
});
