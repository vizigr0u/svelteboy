<script lang="ts">
    import { get } from "svelte/store";
    import type { LibraryRom } from "../types";
    import { loadedCartridge } from "stores/romStores";
    import { deleteLibraryRom, promoteUriToIdb, setRenderModeForRom } from "stores/libraryStore";
    import { getGbNames, getGbcNames } from "../cartridgeNames";
    import { Emulator } from "../emulator";
    import { humanReadableSize } from "../utils";
    import { onMount } from "svelte";
    import { CartType, cartTypeFromCgbFlag, cartTypeLabel, type RenderModeOverride } from "../cartType";
    import { GameFrames } from "stores/playStores";
    import { requestConfirm } from "stores/confirmStore";

    const FRAMES_SILENT_RESET_THRESHOLD = 600;

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
    let cartType = $derived(cartTypeFromCgbFlag(rom.cgbFlag));
    let cartLabel = $derived(cartTypeLabel(cartType));
    let cartBadgeClass = $derived(
        cartType === CartType.CGB_ONLY
            ? "badge-cgb"
            : cartType === CartType.MIXED
              ? "badge-mixed"
              : "badge-gb",
    );
    let currentMode = $derived<RenderModeOverride>(rom.renderMode ?? "auto");

    async function changeRenderMode(mode: RenderModeOverride) {
        if (mode === currentMode) return;
        await setRenderModeForRom(rom.sha1, mode).catch((err) =>
            console.error("setRenderModeForRom failed:", err),
        );
        if (!isLoaded) return;
        const updated: LibraryRom = { ...rom, renderMode: mode };
        const frames = get(GameFrames);
        if (frames < FRAMES_SILENT_RESET_THRESHOLD) {
            playRomPromise = Emulator.PlayRom(updated);
            return;
        }
        const ok = await requestConfirm({
            title: "Reset required",
            message:
                "Switching render mode requires a reset. Unsaved progress will be lost.",
            confirmLabel: "Reset now",
            cancelLabel: "Cancel",
        });
        if (!ok) return;
        playRomPromise = Emulator.PlayRom(updated);
    }
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
        <div class="rom-name">
            {rom.name}
            <span class="cart-badge {cartBadgeClass}" title="Cart type: {cartLabel}">{cartLabel}</span>
        </div>
        <div class="rom-description">{romDescription}</div>
        <div class="render-mode-row" role="radiogroup" aria-label="Render mode">
            {#each [["auto", "Auto"], ["force-gb", "GB"], ["force-cgb", "CGB"]] as [value, label]}
                <label class="render-mode-radio" class:active={currentMode === value}>
                    <input
                        type="radio"
                        name="render-mode-{rom.sha1}"
                        value={value}
                        checked={currentMode === value}
                        onchange={() => changeRenderMode(value as RenderModeOverride)}
                    />
                    {label}
                </label>
            {/each}
        </div>
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

    .cart-badge {
        display: inline-block;
        margin-left: 0.4em;
        padding: 0.05em 0.4em;
        font-size: 0.75em;
        border-radius: 0.25em;
        vertical-align: middle;
        font-weight: bold;
        letter-spacing: 0.02em;
    }
    .cart-badge.badge-gb {
        background: #4a5568;
        color: #e2e8f0;
    }
    .cart-badge.badge-mixed {
        background: #5e548e;
        color: #f4f0fa;
    }
    .cart-badge.badge-cgb {
        background: #d65f5f;
        color: #fff;
    }
    .render-mode-row {
        display: flex;
        gap: 0.25em;
        margin: 0.25em 0;
        flex-wrap: wrap;
        justify-content: center;
    }
    .render-mode-radio {
        display: inline-flex;
        align-items: center;
        gap: 0.2em;
        font-size: 0.8em;
        padding: 0.1em 0.4em;
        border-radius: 0.2em;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.04);
    }
    .render-mode-radio.active {
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
    }
    .render-mode-radio input {
        accent-color: var(--highlight-color, #89b4fa);
        margin: 0;
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
