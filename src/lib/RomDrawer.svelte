<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { libraryStore, deleteLibraryRom, promoteUriToIdb } from "stores/libraryStore";
    import { selectedRomSha1 } from "stores/windowStores";
    import { CartType, cartTypeFromCgbFlag, cartTypeLabel } from "../cartType";
    import { getGbNames, getGbcNames } from "../cartridgeNames";
    import Icon from "./icons/Icon.svelte";
    import PlayTab from "./RomDrawer/PlayTab.svelte";
    import SavesTab from "./RomDrawer/SavesTab.svelte";
    import SettingsTab from "./RomDrawer/SettingsTab.svelte";
    import AboutTab from "./RomDrawer/AboutTab.svelte";
    import { requestConfirm } from "stores/confirmStore";
    import type { LibraryRom } from "../types";

    const artDir = "https://thumbnails.libretro.com/";
    const gbArtDir = artDir + "Nintendo%20-%20Game%20Boy/Named_Boxarts/";
    const gbcArtDir = artDir + "Nintendo%20-%20Game%20Boy%20Color/Named_Boxarts/";
    const defaultThumb = "./UnknownGame.png";

    type TabKey = 'play' | 'saves' | 'settings' | 'about';
    let activeTab: TabKey = $state('play');

    let rom = $derived<LibraryRom | undefined>(
        $selectedRomSha1
            ? $libraryStore.find(r => r.sha1 === $selectedRomSha1)
            : undefined,
    );

    let thumbnailSrc: string = $state(defaultThumb);
    let thumbnailAlt: string = $state('Unknown game art');
    let triggerEl: HTMLElement | null = null;

    $effect(() => {
        if (rom && !triggerEl) {
            triggerEl = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
        }
        if (!rom && triggerEl) {
            try { triggerEl.focus(); } catch {}
            triggerEl = null;
        }
    });

    $effect(() => {
        const r = rom;
        if (!r) return;
        const isGbc = r.name.endsWith('.gbc');
        (isGbc ? getGbcNames() : getGbNames())
            .then(names => {
                const upper = r.sha1.toUpperCase();
                if (upper in names) {
                    thumbnailAlt = names[upper];
                    thumbnailSrc = (isGbc ? gbcArtDir : gbArtDir) + names[upper] + '.png';
                } else {
                    thumbnailSrc = defaultThumb;
                    thumbnailAlt = 'Unknown game art';
                }
            })
            .catch(() => {
                thumbnailSrc = defaultThumb;
                thumbnailAlt = 'Unknown game art';
            });
    });

    let cartType = $derived(rom ? cartTypeFromCgbFlag(rom.cgbFlag) : CartType.DMG_ONLY);
    let cartLabel = $derived(cartTypeLabel(cartType));

    function close() {
        selectedRomSha1.set(undefined);
    }

    function onBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) close();
    }

    function onKey(e: KeyboardEvent) {
        if (!rom) return;
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        }
    }

    onMount(() => {
        window.addEventListener('keydown', onKey);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', onKey);
    });

    async function onPromote() {
        if (!rom || rom.source.kind !== 'uri') return;
        const res = await fetch(rom.source.uri);
        if (!res.ok) return;
        const bytes = await res.arrayBuffer();
        await promoteUriToIdb(rom.sha1, bytes);
    }

    async function onDelete() {
        if (!rom) return;
        const ok = await requestConfirm({
            title: 'Delete ROM',
            message: `Remove "${rom.name}" from your library? Save states stay on disk.`,
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
        });
        if (!ok) return;
        await deleteLibraryRom(rom.sha1);
        close();
    }

    function onThumbErr(e: Event) {
        const img = e.target as HTMLImageElement;
        img.src = defaultThumb;
        img.onerror = null;
    }
</script>

{#if rom}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="rom-drawer-backdrop" onclick={onBackdropClick}>
        <div class="rom-drawer" role="dialog" aria-modal="true" aria-label="ROM details: {rom.name}">
            <header class="drawer-header">
                <img class="drawer-thumb" src={thumbnailSrc} alt={thumbnailAlt} onerror={onThumbErr} />
                <div class="drawer-title-wrap">
                    <div class="drawer-title">{rom.name}</div>
                    <div class="drawer-subtitle">
                        <span class="cart-mini">{cartLabel}</span>
                        {#if rom.mbcKind && rom.mbcKind !== 'none'}
                            <span class="mbc-mini">{rom.mbcKind.toUpperCase()}</span>
                        {/if}
                        {#if rom.hasRtc}<span class="feat" title="RTC"><Icon name="clock" /></span>{/if}
                        {#if rom.hasBattery}<span class="feat" title="Battery"><Icon name="battery" /></span>{/if}
                    </div>
                    {#if rom.source.kind === 'uri'}
                        <button class="install-btn" onclick={onPromote}>Add to library</button>
                    {/if}
                </div>
                <button class="close-btn" onclick={close} aria-label="Close">
                    <Icon name="xmark" />
                </button>
            </header>
            <div class="tab-nav" role="tablist">
                {#each [['play', 'Play'], ['saves', 'Saves'], ['settings', 'Settings'], ['about', 'About']] as [key, label]}
                    <button
                        class="tab-btn"
                        class:active={activeTab === key}
                        role="tab"
                        aria-selected={activeTab === key}
                        onclick={() => (activeTab = key as TabKey)}
                    >{label}</button>
                {/each}
            </div>
            <div class="tab-body">
                {#if activeTab === 'play'}
                    <PlayTab {rom} />
                {:else if activeTab === 'saves'}
                    <SavesTab {rom} />
                {:else if activeTab === 'settings'}
                    <SettingsTab {rom} />
                {:else if activeTab === 'about'}
                    <AboutTab {rom} />
                {/if}
            </div>
            <div class="drawer-footer">
                <button class="danger-btn" onclick={onDelete}>
                    <Icon name="trash" /> Remove from library
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .rom-drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 110;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        justify-content: flex-end;
    }
    .rom-drawer {
        background: #1e1e2e;
        color: #cdd6f4;
        border-left: 1px solid #45475a;
        width: 480px;
        max-width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
        animation: slideIn 0.18s ease-out;
    }
    @keyframes slideIn {
        from { transform: translateX(100%); }
        to   { transform: translateX(0); }
    }
    @media (max-width: 600px) {
        .rom-drawer { width: 100vw; }
    }
    .drawer-header {
        display: grid;
        grid-template-columns: 80px 1fr auto;
        gap: 0.75em;
        padding: 0.75em;
        background: #313244;
        border-bottom: 1px solid #45475a;
        align-items: start;
    }
    .drawer-thumb {
        width: 80px;
        height: 80px;
        object-fit: contain;
        background: white;
        border-radius: 4px;
    }
    .drawer-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        min-width: 0;
    }
    .drawer-title {
        font-weight: 700;
        font-size: 1em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .drawer-subtitle {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3em;
        align-items: center;
        font-size: 0.75em;
    }
    .cart-mini, .mbc-mini {
        padding: 0.05em 0.4em;
        border-radius: 0.2em;
        font-weight: 600;
        letter-spacing: 0.04em;
    }
    .cart-mini { background: #4a5568; color: #e2e8f0; }
    .mbc-mini  { background: #2c3e50; color: #ecf0f1; font-family: ui-monospace, monospace; }
    .feat {
        display: inline-flex;
        align-items: center;
        padding: 0.05em 0.3em;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 0.2em;
        color: #cfd8dc;
    }
    .install-btn {
        margin-top: 0.3em;
        padding: 0.2em 0.6em;
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
        border: none;
        border-radius: 3px;
        font-size: 0.8em;
        cursor: pointer;
        align-self: flex-start;
    }
    .close-btn {
        background: none;
        border: none;
        color: #cdd6f4;
        cursor: pointer;
        font-size: 1.1em;
        padding: 0.2em 0.4em;
    }
    .close-btn:hover { color: #f38ba8; }
    .tab-nav {
        display: flex;
        border-bottom: 1px solid #45475a;
        background: #181825;
    }
    .tab-btn {
        flex: 1;
        background: none;
        border: none;
        color: #888;
        padding: 0.6em;
        cursor: pointer;
        font-size: 0.9em;
        border-bottom: 2px solid transparent;
    }
    .tab-btn.active {
        color: #cdd6f4;
        border-bottom-color: var(--highlight-color, #89b4fa);
    }
    .tab-btn:hover:not(.active) { color: #b0b0b0; }
    .tab-body {
        flex: 1;
        overflow-y: auto;
        padding: 1em;
    }
    .drawer-footer {
        padding: 0.6em 0.75em;
        background: #181825;
        border-top: 1px solid #45475a;
        display: flex;
        justify-content: flex-end;
    }
    .danger-btn {
        background: none;
        border: 1px solid #45475a;
        color: #f38ba8;
        padding: 0.3em 0.7em;
        border-radius: 3px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
    }
    .danger-btn:hover { background: rgba(243, 139, 168, 0.12); }
</style>
