import { get } from "svelte/store";
import { loadCartridgeRom, loadSaveGame as backendLoadSave } from "./wasmBridge";
import { pauseEmulator, resetEmulator, runUntilBreak } from "./lifecycle";
import { getBytesBySha1, promoteUriToIdb, reconcileSha1OnFirstPlay } from "stores/libraryStore";
import { AutoSaveUriRoms } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { DebuggerAttached } from "stores/debugStores";
import { humanReadableSize } from "../utils";
import type { LibraryRom, SaveGameData } from "../types";

async function getRomBuffer(rom: LibraryRom): Promise<ArrayBuffer | undefined> {
    const src = rom.source;
    if (src.kind === 'idb') {
        return getBytesBySha1(rom.sha1);
    }
    if (src.kind === 'uri') {
        const response = await fetch(src.uri);
        if (!response.ok) return undefined;
        return await response.arrayBuffer();
    }
    if (src.kind === 'cloud') {
        throw new Error('Cloud ROM source not implemented');
    }
    return undefined;
}

export async function playRom(rom: LibraryRom): Promise<void> {
    const buffer = await getRomBuffer(rom);
    if (!buffer) return;
    if (!loadCartridgeRom(buffer)) {
        console.log(`Error loading rom`);
        return;
    }
    let activeRom: LibraryRom = rom;
    if (rom.sha1.startsWith('uri:')) {
        const reconciled = await reconcileSha1OnFirstPlay(rom.sha1, buffer, get(AutoSaveUriRoms));
        if (reconciled) activeRom = reconciled;
    } else if (rom.source.kind === 'uri' && get(AutoSaveUriRoms)) {
        promoteUriToIdb(rom.sha1, buffer).catch(err => console.error('promoteUriToIdb failed:', err));
    }
    pauseEmulator();
    resetEmulator();
    loadedCartridge.set(activeRom);
    if (!get(DebuggerAttached))
        runUntilBreak();
}

export function loadSaveGame(savegame: SaveGameData): void {
    console.log(`Loading savegame '${savegame.name}' of size ${humanReadableSize(savegame.buffer.byteLength)}...`);
    backendLoadSave(savegame.buffer);
}
