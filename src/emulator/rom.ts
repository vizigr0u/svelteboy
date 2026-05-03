import { get } from "svelte/store";
import { loadCartridgeRom, loadSaveGame as backendLoadSave, setForcedRenderMode } from "./wasmBridge";
import { pauseEmulator, resetEmulator, runUntilBreak } from "./lifecycle";
import { getBytesBySha1, markLibraryRomPlayed, promoteUriToIdb, reconcileSha1OnFirstPlay, ensureCgbFlag, persistRomFields } from "stores/libraryStore";
import { AutoSaveUriRoms, DefaultRenderMode } from "stores/optionsStore";
import { loadedCartridge } from "stores/romStores";
import { DebuggerAttached } from "stores/debugStores";
import { humanReadableSize } from "../utils";
import { isZipUri, extractRomFromZip } from "../zipRom";
import { CartType, cartTypeFromCgbFlag, resolveRenderMode, type ResolvedRenderMode } from "../cartType";
import { requestConfirm } from "stores/confirmStore";
import type { LibraryRom, SaveGameData } from "../types";

function renderModeToBackend(mode: ResolvedRenderMode): number {
    return mode === 'gb' ? 1 : 2;
}

async function getRomBuffer(rom: LibraryRom): Promise<ArrayBuffer | undefined> {
    const src = rom.source;
    if (src.kind === 'idb') {
        return getBytesBySha1(rom.sha1);
    }
    if (src.kind === 'uri') {
        const response = await fetch(src.uri);
        if (!response.ok) return undefined;
        const buffer = await response.arrayBuffer();
        if (isZipUri(src.uri)) {
            const r = await extractRomFromZip(buffer);
            if (!r.ok) {
                console.error(`zip extract failed (${r.reason}) for ${src.uri}`);
                return undefined;
            }
            return r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength) as ArrayBuffer;
        }
        return buffer;
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
    let activeRom: LibraryRom = ensureCgbFlag(rom, buffer);
    if (activeRom !== rom) {
        persistRomFields({ ...activeRom }).catch(err => console.error('persistRomFields failed:', err));
    }
    if (rom.sha1.startsWith('uri:')) {
        const reconciled = await reconcileSha1OnFirstPlay(rom.sha1, buffer, get(AutoSaveUriRoms));
        if (reconciled) activeRom = ensureCgbFlag(reconciled, buffer);
    } else if (rom.source.kind === 'uri' && get(AutoSaveUriRoms)) {
        promoteUriToIdb(rom.sha1, buffer).catch(err => console.error('promoteUriToIdb failed:', err));
    }
    const cartType = cartTypeFromCgbFlag(activeRom.cgbFlag);
    const resolved = resolveRenderMode(cartType, activeRom.renderMode, get(DefaultRenderMode));
    if (cartType === CartType.CGB_ONLY && resolved === 'gb') {
        const ok = await requestConfirm({
            title: 'CGB-only ROM',
            message: 'This ROM requires Color Game Boy mode. Switch to CGB and continue?',
            confirmLabel: 'Switch',
            cancelLabel: 'Cancel',
        });
        if (!ok) return;
        setForcedRenderMode(renderModeToBackend('cgb'));
    } else {
        setForcedRenderMode(renderModeToBackend(resolved));
    }
    pauseEmulator();
    resetEmulator();
    loadedCartridge.set(activeRom);
    markLibraryRomPlayed(activeRom.sha1).catch(err => console.error('markLibraryRomPlayed failed:', err));
    if (!get(DebuggerAttached))
        runUntilBreak();
}

export function loadSaveGame(savegame: SaveGameData): void {
    console.log(`Loading savegame '${savegame.name}' of size ${humanReadableSize(savegame.buffer.byteLength)}...`);
    backendLoadSave(savegame.buffer);
}
