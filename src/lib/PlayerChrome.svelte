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

    .btn {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.45);
        border: none;
        color: #fff;
        /* width: 4cqw;
        min-width: 1.5em;
        aspect-ratio: 1; */
        border-radius: 50%;
        font-size: max(1.3em, 5cqw);
        padding: 1.5cqw;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
    }
    .btn:hover { background: rgba(0, 0, 0, 0.7); }
    .chrome:not(.visible) .btn,
    .chrome:not(.visible) .big-pause { pointer-events: none; }

    .big-pause {
        pointer-events: auto;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.5);
        padding: 0;
        border: none;
        color: #fff;
        width: 7cqw;
        min-width: 2em;
        aspect-ratio: 1;
        border-radius: 50%;
        font-size: max(2em, 6cqw);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .big-pause:hover { background: rgba(0, 0, 0, 0.75); }
</style>
