<script lang="ts">
    import { loadBootRom, loadCartridgeRom } from "../../build/release";
    import type { RomReference, StoredRom } from "../types";
    import { RomType } from "../types";
    import {
        cartRomStore,
        loadedCartridge,
        loadedBootRom,
    } from "../stores/romStores";
    import { humanReadableSize } from "../utils";
    import gbRomNames from "../gbRomNames";
    import gbcRomNames from "../gbcRomNames";
    import { fetchLogs } from "../debug";

    const defaultThumbnailUri = "/UnknownGame.png";

    export let rom: StoredRom;

    let loadedRom =
        rom.romType == RomType.Boot ? loadedBootRom : loadedCartridge;

    let isLoading: boolean = false;

    const loadFunction: (a: ArrayBuffer) => boolean =
        rom.romType == RomType.Boot ? loadBootRom : loadCartridgeRom;

    function tryLoadRom(): Promise<boolean> {
        return new Promise<boolean>((resolve) =>
            resolve(loadFunction(Buffer.from(rom.contentBase64, "base64")))
        );
    }

    async function loadRom(): Promise<void> {
        const loaded = await tryLoadRom();
        fetchLogs();
        if (!loaded) {
            console.log(`Error loading ${rom.filename}`);
            return;
        }
        $loadedRom = rom;
    }

    function deleteRom() {
        cartRomStore.update((store) => {
            return store.filter((r) => r.sha1 !== rom.sha1);
        });
        if ($loadedRom?.sha1 == rom.sha1) $loadedRom = undefined;
    }

    function onThumbnailError(ev) {
        ev.target.src = defaultThumbnailUri;
        ev.onerror = null;
        ev.preventDefault();
    }

    function getThumbnailUri(rom: RomReference): string {
        const isGbc = rom.filename.endsWith(".gbc");
        const names = isGbc ? gbcRomNames : gbRomNames;
        if (!rom?.sha1 || !(rom.sha1.toUpperCase() in names))
            return defaultThumbnailUri;
        return `https://thumbnails.libretro.com//Nintendo%20-%20Game%20Boy${
            isGbc ? "%20Color" : ""
        }/Named_Boxarts/${names[rom.sha1.toUpperCase()]}.png`;
    }

    function getThumbnailAlt(rom: RomReference): string {
        const isGbc = rom.filename.endsWith(".gbc");
        const names = isGbc ? gbcRomNames : gbRomNames;
        if (!rom?.sha1 || !(rom.sha1.toUpperCase() in names))
            return "Unknown game art";
        return names[rom.sha1.toUpperCase()];
    }
</script>

<div class="rom-container" class:rom-loaded={$loadedRom?.sha1 == rom.sha1}>
    {#if rom != undefined && rom.sha1}
        <img
            class="rom-thumbnail"
            on:error={onThumbnailError}
            src={getThumbnailUri(rom)}
            alt={getThumbnailAlt(rom)}
        />
    {:else}
        {JSON.stringify(rom)}
    {/if}
    <div class="rom-info-container">
        <div class="filename">
            {rom.filename}<br />({humanReadableSize(rom.fileSize)})
        </div>
        <div class="rom-action-buttons">
            <button
                class="rom-action-button"
                on:click={() => loadRom()}
                disabled={isLoading || $loadedRom?.sha1 == rom.sha1}
                >{$loadedRom?.sha1 == rom.sha1
                    ? isLoading
                        ? "LOADING..."
                        : "LOADED"
                    : "LOAD"}</button
            >
            <button
                class="rom-action-button"
                on:click={() => deleteRom()}
                disabled={isLoading}>Delete</button
            >
        </div>
    </div>
</div>

<style>
    .rom-container {
        font-size: small;
        padding: 0.3em 0.5em;
        border: 1px solid #424242;
        background-color: #323232;
        /* width: 15em; */
        /* min-height: 7em; */
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }
    .rom-info-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        align-items: center;
        padding: 0.5em 1em;
    }
    .filename {
        max-width: 21em;
        font-size: 1.1em;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
    }

    .rom-thumbnail {
        width: auto;
        height: auto;
        max-height: 8em;
    }

    .rom-action-buttons {
        display: flex;
        width: 100%;
        justify-content: space-around;
    }

    .rom-action-button {
        padding: 0.2em 0.5em;
        border-radius: 0;
    }

    .rom-loaded {
        background-color: #27312a;
    }
</style>
