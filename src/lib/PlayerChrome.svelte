<script lang="ts">
    import Icon from "./icons/Icon.svelte";
    import { chromeVisible, togglePause, openDrawer } from "stores/playUiStore";
    import { EmulatorPaused } from "stores/playStores";
    import { loadedCartridge } from "stores/romStores";
    import { goToHome } from "stores/viewStore";

    let { minimal = false }: { minimal?: boolean } = $props();

    let title = $derived($loadedCartridge?.name ?? "SvelteBoy");

    function exit() { goToHome(); }
</script>

<!-- Transient overlay drawn on the game view (YouTube player model). Container is
     click-through; only the buttons capture pointer events, so taps on empty
     chrome fall through to the game-view tap surface (reveal / hide).
     minimal = mini-console: Pause only (Library/Cog redundant beside the drawer). -->
<div class="chrome" class:visible={$chromeVisible} class:minimal aria-hidden={!$chromeVisible}>
    {#if !minimal}
        <div class="row top">
            <button class="btn" title="Library" aria-label="Back to library" onclick={exit}>
                <Icon name="hard-drive" />
            </button>
            <button class="btn" title="Settings" aria-label="Open settings" onclick={() => openDrawer('general')}>
                <Icon name="gear" />
            </button>
        </div>
    {/if}

    <button class="big-pause" aria-label={$EmulatorPaused ? "Play" : "Pause"} onclick={togglePause}>
        <Icon name={$EmulatorPaused ? "play" : "pause"} />
    </button>

    {#if !minimal}
        <div class="row bottom">
            <span class="title">{title}</span>
            <button class="btn game" title="Game settings" aria-label="Game settings" onclick={() => openDrawer('game')}>
                <Icon name="gear" /><Icon name="chevron-down" />
            </button>
        </div>
    {/if}
</div>

<style>
    .chrome {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s ease;
        background: linear-gradient(
            rgba(0, 0, 0, 0.45),
            rgba(0, 0, 0, 0) 30%,
            rgba(0, 0, 0, 0) 70%,
            rgba(0, 0, 0, 0.45)
        );
    }
    .chrome.minimal { justify-content: center; background: rgba(0, 0, 0, 0.25); }
    .chrome.visible { opacity: 1; }
    .chrome:not(.visible) { transition: opacity 0.25s ease; }

    .row {
        display: flex;
        align-items: center;
        padding: 0.5em 0.6em;
        gap: 0.5em;
    }
    .row.top { justify-content: space-between; }
    .row.bottom { justify-content: space-between; }

    .title {
        color: #fff;
        font-weight: 600;
        font-size: 0.95em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
        min-width: 0;
    }

    .btn {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.45);
        border: none;
        color: #fff;
        width: 2em;
        height: 2em;
        border-radius: 0.4em;
        font-size: 1.1em;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
    }
    .btn.game { width: auto; gap: 0.1em; padding: 0 0.5em; }
    .btn:hover { background: rgba(0, 0, 0, 0.7); }
    .chrome:not(.visible) .btn,
    .chrome:not(.visible) .big-pause { pointer-events: none; }

    .big-pause {
        pointer-events: auto;
        align-self: center;
        background: rgba(0, 0, 0, 0.5);
        border: none;
        color: #fff;
        width: 3em;
        height: 3em;
        border-radius: 50%;
        font-size: 1.6em;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .big-pause:hover { background: rgba(0, 0, 0, 0.75); }
</style>
