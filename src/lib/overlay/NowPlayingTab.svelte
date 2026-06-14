<script lang="ts">
    import Icon from "../icons/Icon.svelte";
    import SaveSlotStrip from "../SaveSlotStrip.svelte";
    import BatterySaveBanks from "../RomDrawer/BatterySaveBanks.svelte";
    import { loadedCartridge, prefsForRom } from "stores/romStores";
    import { CartType, cartTypeFromCgbFlag, cartTypeLabel } from "../../cartType";
    import { resolveRomArt, onThumbErr, DEFAULT_THUMB_SRC, DEFAULT_THUMB_ALT } from "../../cartArt";
    import { formatRelativeTime } from "../../relativeTime";
    import { resetEmulator } from "../../emulator/lifecycle";
    import { closeOverlay, overlayTab, requestFullscreenToggle } from "stores/overlayStore";

    let cart = $derived($loadedCartridge);
    let prefs = $derived(cart ? prefsForRom(cart.sha1) : null);
    let slotCount = $derived(prefs ? ($prefs?.quickSaveSlotCount ?? 9) : 9);

    let thumbSrc = $state(DEFAULT_THUMB_SRC);
    let thumbAlt = $state(DEFAULT_THUMB_ALT);

    $effect(() => {
        const r = cart;
        if (!r) { thumbSrc = DEFAULT_THUMB_SRC; thumbAlt = DEFAULT_THUMB_ALT; return; }
        resolveRomArt(r).then(art => { thumbSrc = art.src; thumbAlt = art.alt; });
    });

    let cartType = $derived(cart ? cartTypeFromCgbFlag(cart.cgbFlag) : CartType.DMG_ONLY);
    let cartLabel = $derived(cartTypeLabel(cartType));
    let lastPlayed = $derived(cart?.lastPlayedAt ? formatRelativeTime(cart.lastPlayedAt) : "Never");

    function resume() { closeOverlay(); }
    function reset() { resetEmulator(); closeOverlay(); }
    function fullscreen() { closeOverlay(); requestFullscreenToggle(); }
    function goLibrary() { overlayTab.set("library"); }
</script>

{#if cart}
    <div class="now">
        <header class="np-header">
            <img class="np-thumb" src={thumbSrc} alt={thumbAlt} onerror={onThumbErr} />
            <div class="np-meta">
                <div class="np-title">{cart.name}</div>
                <div class="np-chips">
                    <span class="chip cart">{cartLabel}</span>
                    {#if cart.mbcKind && cart.mbcKind !== 'none'}
                        <span class="chip mbc">{cart.mbcKind.toUpperCase()}</span>
                    {/if}
                    {#if cart.hasRtc}<span class="chip feat" title="RTC"><Icon name="clock" /></span>{/if}
                    {#if cart.hasBattery}<span class="chip feat" title="Battery"><Icon name="battery" /></span>{/if}
                </div>
                <div class="np-last">Last played {lastPlayed}</div>
            </div>
        </header>

        <div class="action-row">
            <button class="act primary" onclick={resume}><Icon name="circle-play" /> Resume</button>
            <button class="act" onclick={reset}><Icon name="rotate" /> Reset</button>
            <button class="act" onclick={fullscreen}><Icon name="rotate" /> Fullscreen</button>
        </div>

        <section class="block">
            <h4>Quick saves</h4>
            <SaveSlotStrip {slotCount} onaction={closeOverlay} />
        </section>

        {#if cart.hasBattery}
            <section class="block">
                <BatterySaveBanks sha1={cart.sha1} name={cart.name} />
            </section>
        {/if}
    </div>
{:else}
    <div class="empty-state">
        <p>No ROM loaded.</p>
        <button class="cta" onclick={goLibrary}>Pick from Library</button>
    </div>
{/if}

<style>
    .now { display: flex; flex-direction: column; gap: 1em; }
    .np-header {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 0.8em;
        align-items: start;
    }
    .np-thumb {
        width: 72px; height: 72px;
        object-fit: contain; background: #fff;
        border-radius: 4px;
    }
    .np-meta { display: flex; flex-direction: column; gap: 0.3em; min-width: 0; }
    .np-title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .np-chips { display: flex; flex-wrap: wrap; gap: 0.3em; align-items: center; font-size: 0.75em; }
    .chip { padding: 0.05em 0.4em; border-radius: 0.2em; font-weight: 600; }
    .chip.cart { background: #4a5568; color: #e2e8f0; }
    .chip.mbc { background: #2c3e50; color: #ecf0f1; font-family: ui-monospace, monospace; }
    .chip.feat { display: inline-flex; align-items: center; background: rgba(255,255,255,0.08); color: #cfd8dc; }
    .np-last { font-size: 0.8em; color: #888; }

    .action-row { display: flex; gap: 0.5em; }
    .act {
        flex: 1;
        display: inline-flex; align-items: center; justify-content: center; gap: 0.4em;
        padding: 0.6em 0.5em;
        background: rgba(255,255,255,0.06);
        border: 1px solid #45475a;
        border-radius: 0.4em;
        color: inherit; cursor: pointer; font-size: 0.9em;
    }
    .act:hover { background: rgba(255,255,255,0.12); }
    .act.primary {
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e; border-color: transparent; font-weight: 600;
    }
    .act.primary:hover { filter: brightness(1.08); }

    .block { display: flex; flex-direction: column; gap: 0.5em; }
    .block h4 { margin: 0; font-size: 0.85em; color: #a6adc8; font-weight: 600; }

    .empty-state {
        display: flex; flex-direction: column; align-items: center; gap: 1em;
        padding: 3em 0; color: #888;
    }
    .cta {
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e; border: none; border-radius: 0.4em;
        padding: 0.6em 1.4em; font-weight: 600; cursor: pointer;
    }
</style>
