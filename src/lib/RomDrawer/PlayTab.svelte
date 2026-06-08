<script lang="ts">
    import { Emulator } from "../../emulator";
    import { loadedCartridge } from "stores/romStores";
    import type { LibraryRom } from "../../types";
    import { loadSlot } from "../../saveStateDb";
    import { quickSaveVersion } from "../../saveStateDb";

    let { rom } = $props<{ rom: LibraryRom }>();

    let latestThumb: string | undefined = $state(undefined);

    $effect(() => {
        rom.sha1;
        $quickSaveVersion;
        loadSlot(rom.sha1, 1).then(entry => {
            latestThumb = entry?.thumbnail;
        });
    });

    let isLoaded = $derived($loadedCartridge?.sha1 === rom.sha1);
    let lastPlayed = $derived(rom.lastPlayedAt ? new Date(rom.lastPlayedAt).toLocaleString() : 'Never');

    function play() {
        Emulator.PlayRom(rom);
    }
</script>

<div class="play-tab">
    <div class="thumb-strip">
        {#if latestThumb}
            <img src={latestThumb} alt="Latest save slot 1" />
            <span class="thumb-label">Last quick save (slot 1)</span>
        {:else}
            <div class="thumb-empty">No quick saves yet</div>
        {/if}
    </div>
    <button class="play-button" onclick={play} disabled={isLoaded}>
        {isLoaded ? 'Running' : (latestThumb ? 'Play / Resume' : 'Play')}
    </button>
    <dl class="play-meta">
        <dt>Last played</dt><dd>{lastPlayed}</dd>
    </dl>
</div>

<style>
    .play-tab {
        display: flex;
        flex-direction: column;
        gap: 0.75em;
    }
    .thumb-strip {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3em;
    }
    .thumb-strip img {
        width: 100%;
        max-width: 240px;
        image-rendering: pixelated;
        border-radius: 4px;
        background: #111;
    }
    .thumb-empty {
        color: #666;
        font-style: italic;
        padding: 1.5em 0;
    }
    .thumb-label {
        font-size: 0.8em;
        color: #888;
    }
    .play-button {
        padding: 0.6em 1.2em;
        font-size: 1.1em;
        font-weight: 600;
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .play-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .play-meta {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.3em 0.8em;
        font-size: 0.9em;
        margin: 0;
    }
    .play-meta dt {
        color: #888;
    }
    .play-meta dd {
        margin: 0;
    }
</style>
