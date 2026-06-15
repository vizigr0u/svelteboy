<script lang="ts">
    import Icon from "../icons/Icon.svelte";
    import SavesTab from "../RomDrawer/SavesTab.svelte";
    import SettingsTab from "../RomDrawer/SettingsTab.svelte";
    import AboutTab from "../RomDrawer/AboutTab.svelte";
    import { loadedCartridge } from "stores/romStores";
    import { CartType, cartTypeFromCgbFlag, cartTypeLabel } from "../../cartType";
    import { resolveRomArt, onThumbErr, DEFAULT_THUMB_SRC, DEFAULT_THUMB_ALT } from "../../cartArt";
    import { formatRelativeTime } from "../../relativeTime";
    import { resetEmulator } from "../../emulator/lifecycle";
    import { closeDrawer, requestFullscreenToggle } from "stores/playUiStore";

    type SubTab = "saves" | "settings" | "about";
    let sub: SubTab = $state("saves");

    let cart = $derived($loadedCartridge);

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

    function reset() { resetEmulator(); closeDrawer(); }
    function fullscreen() { closeDrawer(); requestFullscreenToggle(); }
</script>

{#if cart}
    <div class="game">
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
            <button class="act" onclick={reset}><Icon name="rotate" /> Reset</button>
            <button class="act" onclick={fullscreen}><Icon name="play" /> Fullscreen</button>
        </div>

        <div class="sub-nav" role="tablist">
            {#each [['saves', 'Saves'], ['settings', 'Settings'], ['about', 'About']] as [key, label]}
                <button
                    class="sub-btn"
                    class:active={sub === key}
                    role="tab"
                    aria-selected={sub === key}
                    onclick={() => (sub = key as SubTab)}
                >{label}</button>
            {/each}
        </div>

        <div class="sub-body">
            {#if sub === "saves"}
                <SavesTab rom={cart} />
            {:else if sub === "settings"}
                <SettingsTab rom={cart} />
            {:else}
                <AboutTab rom={cart} />
            {/if}
        </div>
    </div>
{:else}
    <div class="empty-state">
        <p>No ROM loaded.</p>
    </div>
{/if}

<style>
    .game { display: flex; flex-direction: column; gap: 0.8em; }
    .np-header { display: grid; grid-template-columns: 64px 1fr; gap: 0.8em; align-items: start; }
    .np-thumb { width: 64px; height: 64px; object-fit: contain; background: #fff; border-radius: 4px; }
    .np-meta { display: flex; flex-direction: column; gap: 0.3em; min-width: 0; }
    .np-title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .np-chips { display: flex; flex-wrap: wrap; gap: 0.3em; align-items: center; font-size: 0.75em; }
    .chip { padding: 0.05em 0.4em; border-radius: 0.2em; font-weight: 600; }
    .chip.cart { background: #4a5568; color: #e2e8f0; }
    .chip.mbc { background: #2c3e50; color: #ecf0f1; font-family: ui-monospace, monospace; }
    .chip.feat { display: inline-flex; align-items: center; background: var(--tint-2); color: #cfd8dc; }
    .np-last { font-size: 0.8em; color: var(--muted-color); }

    .action-row { display: flex; gap: 0.5em; }
    .act {
        flex: 1;
        display: inline-flex; align-items: center; justify-content: center; gap: 0.4em;
        padding: 0.5em;
        background: rgba(255,255,255,0.06);
        border: 1px solid var(--border-color);
        border-radius: 0.4em;
        color: inherit; cursor: pointer; font-size: 0.9em;
    }
    .act:hover { background: var(--tint-3); }

    .sub-nav { display: flex; border-bottom: 1px solid var(--border-color); }
    .sub-btn {
        flex: 1; background: none; border: none; color: var(--muted-color);
        padding: 0.55em; cursor: pointer; font-size: 0.9em;
        border-bottom: 2px solid transparent;
    }
    .sub-btn.active { color: var(--text-color); border-bottom-color: var(--highlight-color); }
    .sub-btn:hover:not(.active) { color: #b0b0b0; }
    .sub-body { padding-top: 0.3em; }

    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 1em; padding: 3em 0; color: var(--muted-color); }
</style>
