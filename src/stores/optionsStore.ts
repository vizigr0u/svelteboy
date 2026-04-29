import { writable } from "svelte/store";
import { MakeIDBStore as MakeLocalStore } from "./idbStore";
import type { KeyBindings, RemoteRom, RemoteRomsList } from "../types";
import { DEFAULT_KEYBINDINGS } from "../keybindPresets";

export type GBPalette = readonly [number, number, number, number];

export const PALETTE_PRESETS: readonly GBPalette[] = [
    [0xffcffde0, 0xff6fc089, 0xff566834, 0xff000000],
    [0xffffffff, 0xffaaaaaa, 0xff555555, 0xff000000],
    [0xff9bcfbe, 0xff7ea89b, 0xff567369, 0xff2e3d38],
    [0xff49b0a5, 0xff65ae91, 0xff5ea98c, 0xff578872],
] as const;

export const PALETTE_NAMES = ['Green', 'Black&White', 'Pocket', 'DMG-01'] as const;

export const SelectedPaletteIndex = MakeLocalStore<number>('option-palette-index', 0);

export const useBoot = writable<boolean>(false);
export const playerPixelSize = MakeLocalStore<number>('option-pixel-size', 3);
export const showFPS = MakeLocalStore<boolean>('option-show-fps', false);
export const showFrametimeHistogram = MakeLocalStore<boolean>('option-show-frametime-histogram', false);
export const HideKeyboardWarning = MakeLocalStore<boolean>('option-hide-keyboard-warning', false);
export const DismissSavesWarning = MakeLocalStore<boolean>('option-hide-saves-warning', false);
export const RemoteRomsListUri = MakeLocalStore<string>('option-remote-roms-list-uri', "");
export const CachedRemoteRoms = MakeLocalStore<RemoteRom[]>('option-cached-remote-roms', []);
export const FetchingRemoteRoms = writable<boolean>(false);
export const ShowDebugger = MakeLocalStore<boolean>("option-show-debugger", false);
export const EmulatorSpeed = writable<number>(1);
// export const AudioBufferSize = writable<number>(512);
export const AudioMasterVolume = MakeLocalStore<number>("option-master-volume", 0.25);
export const KeyBindingsStore = MakeLocalStore<KeyBindings>('option-keybindings', DEFAULT_KEYBINDINGS);

RemoteRomsListUri.subscribe((uri) => {
    if (uri && uri.startsWith("http")) {
        FetchingRemoteRoms.set(true);
        getList(uri).then(list => {
            CachedRemoteRoms.set(list);
            FetchingRemoteRoms.set(false);
        });
    } else {
        CachedRemoteRoms.set([]);
    }
});

async function getList(uri: string): Promise<RemoteRom[]> {
    const res = await fetch(uri);
    const list = (await res.json()) as RemoteRomsList;
    const roms: RemoteRom[] = list.roms.map((r) => ({
        name: r.filename,
        sha1: r.sha1,
        uri: list.baseuri + r.location + "/" + r.filename,
    }));
    return roms;
}
