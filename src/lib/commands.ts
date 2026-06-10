import { get, type Writable } from "svelte/store";
import { Emulator, Debug } from "../emulator";
import { pauseEmulator, unPauseEmulator } from "../emulator/lifecycle";
import { goToHome, goToPlay, playViewActive } from "../stores/viewStore";
import { loadedCartridge, loadedBootRom } from "../stores/romStores";
import { EmulatorPaused, FastForwardActive } from "../stores/playStores";
import {
    showSavesWindow,
    showOptionsWindow,
    showBindingsWindow,
    showDebugWindow,
    showAboutWindow,
    showRomsWindow,
} from "../stores/windowStores";
import { showFPS, showFrametimeHistogram } from "../stores/optionsStore";
import { DebuggerAttached } from "../stores/debugStores";
import { debugUnlocked } from "../stores/paletteStore";

export type CommandGroup = "nav" | "play" | "saves" | "speedrun" | "debug";

export type Command = {
    id: string;
    label: string;
    group: CommandGroup;
    keywords?: string[];
    shortcut?: string;
    available: () => boolean;
    run: () => void | Promise<void>;
};

export const GROUP_LABELS: Record<CommandGroup, string> = {
    nav: "Navigation",
    play: "Playback",
    saves: "Saves",
    speedrun: "Speedrun",
    debug: "Debug",
};

function hasRom(): boolean {
    return !!get(loadedCartridge) || !!get(loadedBootRom);
}

function hasCart(): boolean {
    return !!get(loadedCartridge);
}

function toggleWindow(store: Writable<boolean>): void {
    store.update(v => !v);
}

function openWindow(store: Writable<boolean>): void {
    store.set(true);
}

function toggleFullscreen(): void {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
}

const navCommands: Command[] = [
    {
        id: "nav.library",
        label: "Back to library",
        group: "nav",
        keywords: ["home", "exit"],
        available: () => get(playViewActive),
        run: goToHome,
    },
    {
        id: "nav.resume",
        label: "Resume playing",
        group: "nav",
        keywords: ["play"],
        available: () => !get(playViewActive) && hasRom(),
        run: goToPlay,
    },
    {
        id: "nav.roms",
        label: "Open ROMs library",
        group: "nav",
        keywords: ["games", "list"],
        available: () => true,
        run: () => openWindow(showRomsWindow),
    },
    {
        id: "nav.options",
        label: "Open Options",
        group: "nav",
        keywords: ["settings", "preferences"],
        available: () => true,
        run: () => openWindow(showOptionsWindow),
    },
    {
        id: "nav.bindings",
        label: "Open Bindings",
        group: "nav",
        keywords: ["keys", "keyboard", "shortcuts"],
        available: () => true,
        run: () => openWindow(showBindingsWindow),
    },
    {
        id: "nav.saves",
        label: "Open Saves",
        group: "nav",
        available: () => hasCart(),
        run: () => openWindow(showSavesWindow),
    },
    {
        id: "nav.about",
        label: "Open About",
        group: "nav",
        available: () => true,
        run: () => openWindow(showAboutWindow),
    },
];

const playCommands: Command[] = [
    {
        id: "play.toggle",
        label: "Resume / Pause",
        group: "play",
        keywords: ["play", "stop"],
        shortcut: "P",
        available: () => hasRom(),
        run: () => { if (get(EmulatorPaused)) unPauseEmulator(); else pauseEmulator(); },
    },
    {
        id: "play.reset",
        label: "Reset emulator",
        group: "play",
        keywords: ["restart", "reboot"],
        available: () => hasRom(),
        run: Emulator.Reset,
    },
    {
        id: "play.fullscreen",
        label: "Toggle fullscreen",
        group: "play",
        available: () => true,
        run: toggleFullscreen,
    },
];

const savesCommands: Command[] = [
    ...[1, 2, 3].map<Command>(slot => ({
        id: `saves.save${slot}`,
        label: `Quick save slot ${slot}`,
        group: "saves",
        keywords: ["state", "snapshot"],
        available: () => hasCart() && !get(DebuggerAttached),
        run: () => Emulator.QuickSave(slot),
    })),
    ...[1, 2, 3].map<Command>(slot => ({
        id: `saves.load${slot}`,
        label: `Quick load slot ${slot}`,
        group: "saves",
        keywords: ["state", "restore"],
        available: () => hasCart(),
        run: () => Emulator.QuickLoad(slot),
    })),
];

const speedrunCommands: Command[] = [
    {
        id: "speedrun.fps",
        label: "Toggle frame counter HUD",
        group: "speedrun",
        keywords: ["fps", "counter"],
        available: () => true,
        run: () => toggleWindow(showFPS),
    },
    {
        id: "speedrun.frametime",
        label: "Toggle frametime histogram",
        group: "speedrun",
        keywords: ["fps", "graph"],
        available: () => true,
        run: () => toggleWindow(showFrametimeHistogram),
    },
    {
        id: "speedrun.frameAdvance",
        label: "Frame-advance one frame",
        group: "speedrun",
        keywords: ["step", "tick"],
        available: () => hasRom(),
        run: Debug.RunFrame,
    },
    {
        id: "speedrun.fastForward",
        label: "Toggle fast-forward",
        group: "speedrun",
        keywords: ["ff", "burst", "speed"],
        available: () => hasRom(),
        run: () => FastForwardActive.update(v => !v),
    },
];

const debugCommands: Command[] = [
    {
        id: "debug.window",
        label: "Open Debug window",
        group: "debug",
        available: () => get(debugUnlocked),
        run: () => openWindow(showDebugWindow),
    },
    {
        id: "debug.attach",
        label: "Attach / detach debugger",
        group: "debug",
        keywords: ["break"],
        available: () => get(debugUnlocked) && hasRom(),
        run: () => {
            if (get(DebuggerAttached)) Debug.DetachDebugger();
            else Debug.AttachDebugger();
        },
    },
    {
        id: "debug.step",
        label: "Step one instruction",
        group: "debug",
        available: () => get(debugUnlocked) && hasRom(),
        run: Debug.Step,
    },
];

export const ALL_COMMANDS: readonly Command[] = [
    ...navCommands,
    ...playCommands,
    ...savesCommands,
    ...speedrunCommands,
    ...debugCommands,
];

export const GROUP_ORDER: CommandGroup[] = ["nav", "play", "saves", "speedrun", "debug"];

export async function runCommand(id: string): Promise<void> {
    const cmd = ALL_COMMANDS.find(c => c.id === id);
    if (!cmd) return;
    if (!cmd.available()) return;
    await cmd.run();
}

// Subsequence fuzzy scorer: rewards contiguous matches and earlier positions.
// Returns score >= 0 on match (higher = better), -1 on miss.
export function fuzzyScore(needle: string, haystack: string): number {
    if (!needle) return 0;
    const n = needle.toLowerCase();
    const h = haystack.toLowerCase();
    let hi = 0;
    let score = 0;
    let streak = 0;
    let firstMatch = -1;
    for (let i = 0; i < n.length; i++) {
        const c = n[i];
        let found = -1;
        while (hi < h.length) {
            if (h[hi] === c) { found = hi; break; }
            hi++;
        }
        if (found === -1) return -1;
        if (firstMatch === -1) firstMatch = found;
        const isBoundary = found === 0 || h[found - 1] === ' ' || h[found - 1] === '/';
        score += 10 + streak * 4 + (isBoundary ? 6 : 0);
        streak = (streak === 0 || found === hi) ? streak + 1 : 1;
        hi = found + 1;
    }
    score -= firstMatch;
    return score;
}

export type ScoredCommand = { cmd: Command; score: number };

export function filterCommands(query: string): ScoredCommand[] {
    const q = query.trim();
    const available = ALL_COMMANDS.filter(c => c.available());
    if (!q) return available.map(cmd => ({ cmd, score: 0 }));
    const scored: ScoredCommand[] = [];
    for (const cmd of available) {
        const haystacks = [cmd.label, ...(cmd.keywords ?? [])];
        let best = -1;
        for (const h of haystacks) {
            const s = fuzzyScore(q, h);
            if (s > best) best = s;
        }
        if (best >= 0) scored.push({ cmd, score: best });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
}
