<script lang="ts">
    import type { LibraryRom } from "../types";
    import { loadedCartridge } from "stores/romStores";
    import { getGbNames, getGbcNames } from "../cartridgeNames";
    import { Emulator } from "../emulator";
    import { humanReadableSize } from "../utils";
    import { onMount } from "svelte";
    import { CartType, cartTypeFromCgbFlag, cartTypeLabel } from "../cartType";
    import { SaveGames } from "stores/playStores";
    import { romMenuTrigger } from "./romMenuAction";
    import { openRomMenu } from "stores/romMenuStore";
    import Icon from "./icons/Icon.svelte";
    import type { IconName } from "./icons/Icon.svelte";

    const defaultThumbnailUri = "./UnknownGame.png";
    const defaultAltText = "Unknown game art";
    const artDir = import.meta.env.DEV
        ? "/libretro-art/"
        : "https://thumbnails.libretro.com/";
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
    let mbcLabel = $derived(
        rom.mbcKind && rom.mbcKind !== "none"
            ? rom.mbcKind.toUpperCase()
            : undefined,
    );
    let savesForRom = $derived(
        $SaveGames.filter((s) => s.gameSha1 === rom.sha1).length,
    );
    let sizeLabel = $derived(
        rom.fileSize !== undefined ? humanReadableSize(rom.fileSize) : undefined,
    );
    let isRemoteOnly = $derived(rom.source.kind === "uri");

    // Tap = play (resume-aware: ResumeRom cold-loads then restores any auto-snap).
    function play(e: MouseEvent) {
        if ((e.target as HTMLElement).closest('button, input, label, a')) return;
        playRomPromise = Emulator.ResumeRom(rom).then(() => {});
    }
    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            playRomPromise = Emulator.ResumeRom(rom).then(() => {});
        }
    }
    function onMenuKey(e: KeyboardEvent) {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            openRomMenu(rom, r.left + 16, r.top + 16);
        }
    }

    let kindIcon = $derived<IconName>(
        rom.source.kind === "idb"
            ? "hard-drive"
            : rom.source.kind === "uri"
              ? "cloud"
              : "question",
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

    function getRomDescription(rom: LibraryRom): string {
        if (rom.source.kind === "uri") return rom.source.uri;
        return "";
    }

    function onThumbnailError(ev: any) {
        ev.target.src = defaultThumbnailUri;
        ev.target.alt = defaultAltText;
        ev.onerror = null;
        ev.preventDefault();
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="rom-container"
    class:rom-loaded={isLoaded}
    class:rom-remote-only={isRemoteOnly}
    onclick={play}
    onkeydown={(e) => { onKey(e); onMenuKey(e); }}
    use:romMenuTrigger={rom}
    role="button"
    tabindex="0"
    aria-label="Play {rom.name} (long-press or right-click for options)">
    <div class="image-wrapper">
        <img
            class="rom-thumbnail"
            onerror={onThumbnailError}
            {src}
            {alt}
            loading="lazy"
        />
        <span class="kind-badge" title={kindTitle} aria-label={kindTitle}>
            <Icon name={kindIcon} />
        </span>
        <div class="over-image-box">
            {#await playRomPromise}
                <div class="loading-rom-placeholder">
                    <Icon name="spinner" />
                </div>
            {:then}
                <button
                    class="rom-play-button"
                    onclick={() => {
                        playRomPromise = Emulator.PlayRom(rom);
                    }}
                    disabled={isLoading || isLoaded}
                    aria-label="Play"
                    ><Icon name="circle-play" /></button
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
        <div class="meta-badge-row" aria-label="Cartridge features">
            {#if mbcLabel}
                <span class="meta-chip mbc-chip" title="Bank controller: {mbcLabel}">{mbcLabel}</span>
            {/if}
            {#if rom.hasRtc}
                <span class="meta-chip" title="Real-time clock">
                    <Icon name="clock" /> RTC
                </span>
            {/if}
            {#if rom.hasBattery}
                <span class="meta-chip" title="Battery-backed save">
                    <Icon name="battery" /> BATT
                </span>
            {/if}
            {#if sizeLabel}
                <span class="meta-chip size-chip" title="ROM size">{sizeLabel}</span>
            {/if}
            {#if savesForRom > 0}
                <span class="meta-chip has-save" title="{savesForRom} save{savesForRom === 1 ? '' : 's'} on this ROM">
                    <Icon name="bookmark" /> {savesForRom}
                </span>
            {/if}
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
        cursor: pointer;
    }
    .rom-container:hover {
        border-color: var(--highlight-color);
    }
    .rom-container:focus-visible {
        outline: 2px solid var(--highlight-color);
        outline-offset: 1px;
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

    .over-image-box :global(.icon) {
        text-align: center;
        vertical-align: middle;
        font-size: 3em;
        color: rgba(255, 255, 255, 0.8);
        padding: 0.2em;
        background-color: rgba(0, 0, 0, 0.38);
        border-radius: 50%;
    }

    .rom-play-button:hover > :global(.icon) {
        color: var(--highlight-color);
        background-color: rgba(0, 0, 0, 0.28);
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
    .rom-loaded {
        background-color: #27312a;
    }

    @media (prefers-color-scheme: light) {
        .rom-loaded {
            background-color: #a6bdad;
        }
    }

    .rom-remote-only {
        opacity: 0.78;
    }
    .rom-remote-only:hover {
        opacity: 1;
    }

    .meta-badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25em;
        justify-content: center;
        margin: 0.15em 0;
    }
    .meta-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.2em;
        padding: 0.05em 0.4em;
        font-size: 0.7em;
        font-weight: 600;
        letter-spacing: 0.04em;
        background: rgba(255, 255, 255, 0.07);
        color: #cfd8dc;
        border-radius: 0.2em;
        line-height: 1.3;
    }
    .meta-chip :global(.icon) {
        font-size: 0.9em;
    }
    .meta-chip.mbc-chip {
        background: #2c3e50;
        color: #ecf0f1;
        font-family: ui-monospace, monospace;
    }
    .meta-chip.size-chip {
        background: rgba(255, 255, 255, 0.04);
        color: #aaa;
    }
    .meta-chip.has-save {
        background: #2d5a4f;
        color: #b8e6d2;
    }
</style>
