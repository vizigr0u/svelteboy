import { writable } from "svelte/store";
import { MakeLocalStore } from "./localStorageStore";
import type { RemoteRom, RemoteRomsList } from "../types";

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

async function getList(uri): Promise<RemoteRom[]> {
    const res = await fetch(uri);
    const list = (await res.json()) as RemoteRomsList;
    const roms: RemoteRom[] = list.roms.map((r) => ({
        name: r.filename,
        sha1: r.sha1,
        uri: list.baseuri + r.location + "/" + r.filename,
    }));
    return roms;
}
