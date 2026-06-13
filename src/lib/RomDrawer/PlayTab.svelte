<script lang="ts">
    import { Emulator } from "../../emulator";
    import { loadedCartridge } from "stores/romStores";
    import type { LibraryRom } from "../../types";
    import { loadAuto, autoSnapVersion } from "../../saveStateDb";
    import { formatRelativeTime } from "../../relativeTime";
    import { onMount, onDestroy } from "svelte";

    let { rom } = $props<{ rom: LibraryRom }>();

    let autoThumb: string | undefined = $state(undefined);
    let autoSavedAt: number | undefined = $state(undefined);
    let labelTick = $state(0);
    let tickHandle: ReturnType<typeof setInterval> | undefined;

    $effect(() => {
        rom.sha1;
        $autoSnapVersion;
        loadAuto(rom.sha1).then(entry => {
            autoThumb = entry?.thumbnail;
            autoSavedAt = entry?.savedAt;
        });
    });

    onMount(() => {
        tickHandle = setInterval(() => { labelTick++; }, 30_000);
    });
    onDestroy(() => {
        if (tickHandle) clearInterval(tickHandle);
    });

    let isLoaded = $derived($loadedCartridge?.sha1 === rom.sha1);
    let lastPlayed = $derived(rom.lastPlayedAt ? new Date(rom.lastPlayedAt).toLocaleString() : 'Never');
    let busy = $state(false);
    let relLabel = $derived.by(() => {
        labelTick;
        return autoSavedAt ? formatRelativeTime(autoSavedAt) : undefined;
    });

    async function resume() {
        if (busy) return;
        busy = true;
        try {
            if (autoThumb) await Emulator.ResumeRom(rom);
            else await Emulator.PlayRom(rom);
        } finally {
            busy = false;
        }
    }

    async function playFromBoot() {
        if (busy) return;
        busy = true;
        try {
            await Emulator.PlayRom(rom, { purgeAutoOnLoad: true });
        } finally {
            busy = false;
        }
    }
</script>

<div class="play-tab">
    <div class="thumb-strip">
        {#if autoThumb}
            <img src={autoThumb} alt="Auto-saved session" />
            <span class="thumb-label">Auto-saved {relLabel}</span>
        {:else}
            <div class="thumb-empty">No saved session yet</div>
        {/if}
    </div>
    <button class="btn btn-primary play-button" onclick={resume} disabled={isLoaded || busy}>
        {isLoaded ? 'Running' : (autoThumb ? `Resume · ${relLabel}` : 'Play')}
    </button>
    {#if autoThumb}
        <button class="btn btn-secondary secondary-button" onclick={playFromBoot} disabled={isLoaded || busy}>
            Reset and play from boot
        </button>
    {/if}
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
        background: var(--section-bg-color);
    }
    .thumb-empty {
        color: var(--muted-color);
        font-style: italic;
        padding: 1.5em 0;
    }
    .thumb-label {
        font-size: 0.8em;
        color: var(--muted-color);
    }
    .play-button {
        font-size: 1.1em;
        font-weight: 600;
    }
    .secondary-button {
        min-height: 2.25rem;
        padding-inline: var(--space-4);
        font-size: 0.85em;
    }
    .play-meta {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.3em 0.8em;
        font-size: 0.9em;
        margin: 0;
    }
    .play-meta dt {
        color: var(--muted-color);
    }
    .play-meta dd {
        margin: 0;
    }
</style>
