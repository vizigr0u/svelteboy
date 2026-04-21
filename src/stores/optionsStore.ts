import { writable } from "svelte/store";
import { MakeIDBStore as MakeLocalStore } from "./idbStore";
import type { KeyBindings, RemoteRom, RemoteRomsList } from "../types";
import { DEFAULT_KEYBINDINGS } from "../keybindPresets";

export const useBoot = writable<boolean>(false);
export const playerPixelSize = MakeLocalStore<number>('option-pixel-size', 3);
export const showFPS = MakeLocalStore<boolean>('option-show-fps', false);
export const HideKeyboardWarning = MakeLocalStore<boolean>('option-hide-keyboard-warning', false);
export const DismissSavesWarning = MakeLocalStore<boolean>('option-hide-saves-warning', false);
export const RemoteRomsListUri = MakeLocalStore<string>('option-remote-roms-list-uri', "");
export const CachedRemoteRoms = MakeLocalStore<RemoteRom[]>('option-cached-remote-roms', []);
export const FetchingRemoteRoms = writable<boolean>(false);
export const ShowDebugger = MakeLocalStore<boolean>("option-show-debugger", false);
export const EmulatorSpeed = writable<number>(1);
// export const AudioBufferSize = writable<number>(512);
export const AudioMasterVolume = MakeLocalStore<number>("option-master-volume", 0.25);
const _storedBindings = JSON.parse(localStorage.getItem('option-keybindings') || 'null');
if (_storedBindings && typeof _storedBindings === 'object') {
    localStorage.setItem('option-keybindings', JSON.stringify({ ...DEFAULT_KEYBINDINGS, ..._storedBindings }));
}
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
