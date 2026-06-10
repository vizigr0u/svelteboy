import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LibraryRom } from './types';

vi.mock('./cartridgeNames', () => ({
    getGbNames: vi.fn(),
    getGbcNames: vi.fn(),
}));

async function fresh() {
    vi.resetModules();
    return {
        art: await import('./cartArt'),
        names: await import('./cartridgeNames'),
    };
}

const mkRom = (name: string, sha1: string): LibraryRom => ({
    name, sha1, source: { kind: 'idb' }, fileSize: 1, addedAt: 0,
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('resolveRomArt', () => {
    it('hit GB name → GB art dir filename', async () => {
        const { art, names } = await fresh();
        (names.getGbNames as any).mockResolvedValue({ 'ABC123': 'Tetris (World)' });
        const out = await art.resolveRomArt(mkRom('tetris.gb', 'abc123'));
        expect(out.alt).toBe('Tetris (World)');
        expect(out.src).toContain('Nintendo%20-%20Game%20Boy/Named_Boxarts/');
        expect(out.src.endsWith('Tetris (World).png')).toBe(true);
    });

    it('hit GBC name (.gbc) → GBC art dir', async () => {
        const { art, names } = await fresh();
        (names.getGbcNames as any).mockResolvedValue({ 'DEADBEEF': 'Pokemon Crystal' });
        const out = await art.resolveRomArt(mkRom('crystal.gbc', 'deadbeef'));
        expect(out.alt).toBe('Pokemon Crystal');
        expect(out.src).toContain('Nintendo%20-%20Game%20Boy%20Color/Named_Boxarts/');
        expect(out.src.endsWith('Pokemon Crystal.png')).toBe(true);
    });

    it('miss → DEFAULT_THUMB_SRC', async () => {
        const { art, names } = await fresh();
        (names.getGbNames as any).mockResolvedValue({ 'OTHER': 'x' });
        const out = await art.resolveRomArt(mkRom('unknown.gb', 'abc123'));
        expect(out.src).toBe(art.DEFAULT_THUMB_SRC);
        expect(out.alt).toBe(art.DEFAULT_THUMB_ALT);
    });

    it('lowercase sha1 input matches uppercase keys', async () => {
        const { art, names } = await fresh();
        (names.getGbNames as any).mockResolvedValue({ 'AABBCC': 'Game' });
        const out = await art.resolveRomArt(mkRom('game.gb', 'aabbcc'));
        expect(out.alt).toBe('Game');
    });

    it('getGbNames throws → fallback to default', async () => {
        const { art, names } = await fresh();
        (names.getGbNames as any).mockRejectedValue(new Error('fetch fail'));
        const out = await art.resolveRomArt(mkRom('any.gb', 'aabbcc'));
        expect(out.src).toBe(art.DEFAULT_THUMB_SRC);
        expect(out.alt).toBe(art.DEFAULT_THUMB_ALT);
    });
});
