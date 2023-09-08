<script lang="ts">
    import {
        type RemoteRom,
        type StoredRom,
        type RomReference,
        isStoredRom,
        isLocalRom,
        type LocalRom,
        isRemoteRom,
        RomReferenceType,
        getRomReferenceType,
    } from "../types";
    import { cartRomStore, loadedCartridge } from "../stores/romStores";
    import { humanReadableSize } from "../utils";
    import { fetchLogs } from "../debug";
    import { getGbNames, getGbcNames } from "../cartridgeNames";
    import { Buffer } from "buffer";
    import { Emulator } from "../emulator";

    const defaultThumbnailUri = "./UnknownGame.png";
    const defaultAltText = "Unknown game art";
    const artDir = "https://static.vizigrou.com/svelteboy/";
    const gbArtDir = artDir + "gb_art/";
    const gbcArtDir = artDir + "gbc_art/";

    export let rom: RomReference;

    type RomImgData = {
        src: string;
        alt: string;
    };

    let imagePromise: Promise<RomImgData> = undefined;

    let playRomPromise: Promise<void> = undefined;

    let buffer: ArrayBuffer = undefined;

    let loadingRomStatus = "";

    $: imagePromise = fetchImageAndAlt(rom);

    let isLoaded: boolean;
    $: isLoaded =
        $loadedCartridge != undefined && $loadedCartridge.sha1 == rom.sha1;

    async function fetchImageAndAlt(rom: RomReference): Promise<RomImgData> {
        const isGbc = rom.name.endsWith(".gbc");
        const names = isGbc ? await getGbcNames() : await getGbNames();
        let src = defaultThumbnailUri;
        let alt = defaultAltText;
        if (rom.sha1.toUpperCase() in names) {
            alt = names[rom.sha1.toUpperCase()];
            src = (isGbc ? gbcArtDir : gbArtDir) + alt + ".png";
        }
        return { src, alt };
    }

    let isLoading: boolean = false;

    async function getRomBuffer(): Promise<ArrayBuffer> {
        if (buffer == undefined || buffer.byteLength == 0) {
            if (isStoredRom(rom)) {
                const storedRom: StoredRom = rom;
                buffer = Buffer.from(storedRom.contentBase64, "base64");
            }
            if (isLocalRom(rom)) {
                const localRom: LocalRom = rom;
                buffer = localRom.buffer;
            }
            if (isRemoteRom(rom)) {
                const remoteRom: RemoteRom = rom;
                const response = await fetch(remoteRom.uri);
                buffer = await response.arrayBuffer();
            }
        }
        return buffer;
    }

    async function playRom(): Promise<void> {
        loadingRomStatus = "Downloading";
        const buffer = await getRomBuffer();
        loadingRomStatus = "Loading";
        const loaded = await new Promise<boolean>((r) =>
            r(Emulator.LoadCartridgeRom(buffer))
        );
        fetchLogs();
        if (!loaded) {
            console.log(`Error loading rom`);
            return;
        }
        loadingRomStatus = "";
        Emulator.Pause();
        Emulator.Reset();
        $loadedCartridge = rom;
        Emulator.RunUntilBreak();
    }

    function deleteRom() {
        cartRomStore.update((store) => {
            return store.filter((r) => r.sha1 !== rom.sha1);
        });
        if (isLoaded) $loadedCartridge = undefined;
    }

    function onThumbnailError(ev) {
        ev.target.src = defaultThumbnailUri;
        ev.onerror = null;
        ev.preventDefault();
    }
</script>

<div class="rom-container" class:rom-loaded={isLoaded}>
    <div class="image-wrapper">
        {#await imagePromise}
            <img
                class="rom-thumbnail"
                src={defaultThumbnailUri}
                alt={defaultAltText}
                loading="lazy"
            />
        {:then imgData}
            {#key rom.sha1}
                <img
                    class="rom-thumbnail"
                    on:error={onThumbnailError}
                    src={imgData.src}
                    alt={imgData.alt}
                    loading="lazy"
                />
            {/key}
        {:catch}
            <img
                class="rom-thumbnail"
                src={defaultThumbnailUri}
                alt={defaultAltText}
                loading="lazy"
            />
        {/await}
        <div class="over-image-box">
            {#await playRomPromise}
                <div class="loading-rom-placeholder">
                    Loading <i class="fas fa-spinner fa-spin" />
                </div>
                <div class="loading-rom-status">{loadingRomStatus}</div>
            {:then imgData}
                <button
                    class="rom-play-button"
                    on:click={() => {
                        playRomPromise = playRom();
                    }}
                    disabled={isLoading || isLoaded}
                    ><i class="fa-regular fa-circle-play" /></button
                >
            {/await}
        </div>
    </div>
    <div class="rom-info-container">
        <div class="rom-name">{rom.name}</div>
        {RomReferenceType[getRomReferenceType(rom)]}
        <div class="rom-action-buttons">
            {#if isLocalRom(rom)}
                <button
                    class="rom-action-button"
                    on:click={() => deleteRom()}
                    disabled={isLoading}>Delete</button
                >
            {/if}
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
    .image-wrapper {
        position: relative;
    }
    .over-image-box {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 1.5em;
        margin: auto;
        width: 5em;
        height: 6em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .rom-play-button {
        border: unset;
        padding: 0;
        margin: 0;
        color: rgba(255, 255, 255, 0.4);
        background-color: unset;
        font-size: 4rem;
        line-height: 50%;
        text-align: center;
        vertical-align: middle;
    }
    .rom-play-button:hover {
        color: var(--highlight-color);
    }
    .rom-info-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        align-items: center;
        padding: 0.5em 1em;
    }
    .rom-name {
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
