import { get } from "svelte/store";
import { EmulatorPaused, FastForwardActive } from "stores/playStores";
import { loadedBootRom, loadedCartridge } from "stores/romStores";
import { Emulator } from "./emulator";
import { takeScreenshot } from "./screenshot";
import { KeybindingsStore } from "./keybinds/store";
import { DEFAULT_SLOT_RANGES } from "./keybinds/defaults";
import { matchBinding, slotFromCode } from "./keybinds/match";
import type { Bindings, BindingId } from "./keybinds/types";

type Action = (e: KeyboardEvent) => void;

let bindings: Bindings | null = null;
KeybindingsStore.subscribe(b => { bindings = b; });

function hasRom(): boolean {
    return !!get(loadedCartridge) || !!get(loadedBootRom);
}

const downActions: Record<BindingId, Action | null> = {
    pause: (e) => {
        if (e.repeat) return;
        if (!hasRom()) return;
        e.preventDefault();
        if (get(EmulatorPaused)) Emulator.RunUntilBreak();
        else Emulator.Pause();
    },
    reset: (e) => {
        if (e.repeat) return;
        if (!hasRom()) return;
        e.preventDefault();
        Emulator.Reset();
    },
    screenshot: (e) => {
        if (e.repeat) return;
        if (!hasRom()) return;
        e.preventDefault();
        takeScreenshot();
    },
    fastForward: (e) => {
        if (e.repeat) return;
        e.preventDefault();
        FastForwardActive.set(true);
    },
    gameA: null, gameB: null, gameSelect: null, gameStart: null,
    gameUp: null, gameDown: null, gameLeft: null, gameRight: null,
};

window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.defaultPrevented || !bindings) return;

    const save = slotFromCode(e, DEFAULT_SLOT_RANGES.quickSave);
    if (save !== null) { e.preventDefault(); Emulator.QuickSave(save); return; }
    const load = slotFromCode(e, DEFAULT_SLOT_RANGES.quickLoad);
    if (load !== null) { e.preventDefault(); Emulator.QuickLoad(load); return; }

    for (const id in downActions) {
        const action = downActions[id as BindingId];
        if (!action) continue;
        if (matchBinding(e, bindings[id as BindingId])) { action(e); return; }
    }
});

window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.defaultPrevented || !bindings) return;
    if (e.code === bindings.fastForward.code) {
        e.preventDefault();
        FastForwardActive.set(false);
    }
});

window.addEventListener('blur', () => FastForwardActive.set(false));
