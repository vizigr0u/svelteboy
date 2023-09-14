<script lang="ts">
    import {
        type RomReference,
        isStoredRom,
        RomReferenceType,
        getRomReferenceType,
        isRemoteRom,
    } from "../types";
    import { cartRomStore, loadedCartridge } from "stores/romStores";
    import { getGbNames, getGbcNames } from "../cartridgeNames";
    import { Emulator } from "../emulator";
    import { humanReadableSize } from "../utils";
    import { onMount } from "svelte";

    const defaultThumbnailUri = "./UnknownGame.png";
    const defaultAltText = "Unknown game art";
    const artDir = "https://static.vizigrou.com/svelteboy/";
    const gbArtDir = artDir + "gb_art/";
    const gbcArtDir = artDir + "gbc_art/";

    export let rom: RomReference;

    let romDescription: string;

    let src: string = defaultThumbnailUri;
    let alt: string = defaultAltText;

    type RomImgData = {
        src: string;
        alt: string;
    };

    // let imagePromise: Promise<RomImgData> = new Promise<RomImgData>((r) =>
    //     r({
    //         src: defaultThumbnailUri,
    //         alt: defaultAltText,
    //     })
    // );

    onMount(() => {
        fetchImageAndAlt(rom)
            .then((data) => {
                src = data.src;
                alt = data.alt;
            })
            .catch(() => {
                src = defaultThumbnailUri;
                alt = defaultAltText;
            });
    });

    let playRomPromise: Promise<void> = undefined;
    let isLoading: boolean = false;

    // $: imagePromise = fetchImageAndAlt(rom);

    $: romDescription = getRomDescription(rom);

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

    function deleteRom() {
        cartRomStore.update((store) => {
            return store.filter((r) => r.sha1 !== rom.sha1);
        });
        if (isLoaded) $loadedCartridge = undefined;
    }

    function getRomDescription(rom: RomReference): string {
        if (isRemoteRom(rom)) {
            return rom.uri;
        }
        if (isStoredRom(rom)) {
            return humanReadableSize(rom.contentBase64.length);
        }
        return RomReferenceType[getRomReferenceType(rom)];
    }

    function onThumbnailError(ev) {
        ev.target.src = defaultThumbnailUri;
        ev.target.alt = defaultAltText;
        ev.onerror = null;
        ev.preventDefault();
    }
</script>

<div class="rom-container" class:rom-loaded={isLoaded}>
    <div class="image-wrapper">
        <img
            class="rom-thumbnail"
            on:error={onThumbnailError}
            {src}
            {alt}
            loading="lazy"
        />
        <div class="over-image-box">
            {#await playRomPromise}
                <div class="loading-rom-placeholder">
                    <i class="fas fa-spinner fa-spin" />
                </div>
            {:then}
                <button
                    class="rom-play-button"
                    on:click={() => {
                        playRomPromise = Emulator.PlayRom(rom);
                        // playRomPromise = new Promise((r) => {}); // Debug loading spinner
                    }}
                    disabled={isLoading || isLoaded}
                    ><i class="fa-regular fa-circle-play" /></button
                >
            {/await}
        </div>
    </div>
    <div class="rom-info-container">
        <div class="rom-name">{rom.name}</div>
        {romDescription}
        <div class="rom-action-buttons">
            {#if isStoredRom(rom)}
                <button
                    class="rom-action-button"
                    on:click={deleteRom}
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
        width: 8em;
        height: 8em;
        display: flex;
        background-color: white;
    }
    .over-image-box {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        /* bottom: 1.5em; */
        bottom: 0;
        margin: auto;
        display: flex;
        flex: 1;
        justify-content: center;
        align-items: center;
    }
    .rom-play-button {
        border: unset;
        padding: 0;
        margin: 0;
        background-color: unset;
        flex: 1;
    }

    .over-image-box i {
        text-align: center;
        vertical-align: middle;
        font-size: 3em;
        color: rgba(255, 255, 255, 0.5);
        padding: 0.2em;
        background-color: rgba(0, 0, 0, 0.3);
        border-radius: 50%;
    }

    .rom-play-button:hover > i {
        color: var(--highlight-color);
        background-color: rgba(0, 0, 0, 0.5);
    }

    .rom-info-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        align-items: center;
        padding: 0.5em 1em;
        max-width: 40em;
        overflow-x: auto;
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
