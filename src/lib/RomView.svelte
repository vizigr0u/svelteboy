<script lang="ts">
    import type { LibraryRom } from "../types";
    import { loadedCartridge } from "stores/romStores";
    import { deleteLibraryRom, promoteUriToIdb } from "stores/libraryStore";
    import { getGbNames, getGbcNames } from "../cartridgeNames";
    import { Emulator } from "../emulator";
    import { humanReadableSize } from "../utils";
    import { onMount } from "svelte";

    const defaultThumbnailUri = "./UnknownGame.png";
    const defaultAltText = "Unknown game art";
    const artDir = "https://thumbnails.libretro.com/";
    const gbArtDir = artDir + "Nintendo%20-%20Game%20Boy/Named_Boxarts/";
    const gbcArtDir =
        artDir + "Nintendo%20-%20Game%20Boy%20Color/Named_Boxarts/";

    let { rom } = $props<{ rom: LibraryRom }>();

    let src: string = $state(defaultThumbnailUri);
    let alt: string = $state(defaultAltText);

    type RomImgData = {
        src: string;
        alt: string;
    };

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

    let playRomPromise: Promise<void> | undefined = $state(undefined);
    let savePromise: Promise<void> | undefined = $state(undefined);
    let isLoading: boolean = $state(false);

    let romDescription = $derived(getRomDescription(rom));
    let isLoaded = $derived(
        $loadedCartridge != undefined && $loadedCartridge.sha1 == rom.sha1,
    );
    let kindIcon = $derived(
        rom.source.kind === "idb"
            ? "fa-solid fa-hard-drive"
            : rom.source.kind === "uri"
              ? "fa-solid fa-cloud"
              : "fa-solid fa-question",
    );
    let kindTitle = $derived(
        rom.source.kind === "idb"
            ? "Stored locally"
            : rom.source.kind === "uri"
              ? "Remote"
              : "Cloud",
    );

    async function fetchImageAndAlt(rom: LibraryRom): Promise<RomImgData> {
        const isGbc = rom.name.endsWith(".gbc");
        const names = isGbc ? await getGbcNames() : await getGbNames();
        let src = defaultThumbnailUri;
        let alt = defaultAltText;
        const sha1Upper = rom.sha1.toUpperCase();
        if (sha1Upper in names) {
            alt = names[sha1Upper];
            src = (isGbc ? gbcArtDir : gbArtDir) + alt + ".png";
        }
        return { src, alt };
    }

    async function deleteRom() {
        await deleteLibraryRom(rom.sha1);
        if (isLoaded) $loadedCartridge = undefined;
    }

    function getRomDescription(rom: LibraryRom): string {
        if (rom.source.kind === "uri") return rom.source.uri;
        if (rom.fileSize !== undefined) return humanReadableSize(rom.fileSize);
        return "";
    }

    async function saveLocally() {
        if (rom.source.kind !== "uri") return;
        const res = await fetch(rom.source.uri);
        if (!res.ok) return;
        const bytes = await res.arrayBuffer();
        await promoteUriToIdb(rom.sha1, bytes);
    }

    function onThumbnailError(ev: any) {
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
            onerror={onThumbnailError}
            {src}
            {alt}
            loading="lazy"
        />
        <span class="kind-badge" title={kindTitle} aria-label={kindTitle}>
            <i class={kindIcon}></i>
        </span>
        <div class="over-image-box">
            {#await playRomPromise}
                <div class="loading-rom-placeholder">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
            {:then}
                <button
                    class="rom-play-button"
                    onclick={() => {
                        playRomPromise = Emulator.PlayRom(rom);
                    }}
                    disabled={isLoading || isLoaded}
                    aria-label="Play"
                    ><i class="fa-regular fa-circle-play"></i></button
                >
            {/await}
        </div>
    </div>
    <div class="rom-info-container">
        <div class="rom-name">{rom.name}</div>
        <div class="rom-description">{romDescription}</div>
        <div class="rom-action-buttons">
            {#if rom.source.kind === "uri"}
                <button
                    class="rom-action-button"
                    onclick={() => {
                        savePromise = saveLocally();
                    }}
                    disabled={isLoading || savePromise !== undefined}
                >
                    {#await savePromise}
                        Saving...
                    {:then}
                        Save locally
                    {/await}
                </button>
            {/if}
            <button
                class="rom-action-button"
                onclick={deleteRom}
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
        background-color: var(--subsection-bg-color);
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
    .kind-badge {
        position: absolute;
        top: 0.2em;
        left: 0.2em;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        padding: 0.1em 0.35em;
        border-radius: 0.2em;
        font-size: 0.85em;
        line-height: 1;
        pointer-events: none;
    }
    .over-image-box {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
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
    .rom-description {
        font-size: 0.9em;
        color: #aaa;
        word-break: break-all;
        text-align: center;
        max-width: 100%;
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
        gap: 0.4em;
    }

    .rom-action-button {
        padding: 0.2em 0.5em;
        border-radius: 0;
    }

    .rom-loaded {
        background-color: #27312a;
    }

    @media (prefers-color-scheme: light) {
        .rom-loaded {
            background-color: #a6bdad;
        }
    }
</style>
