<script lang="ts">
    import type { LibraryRom } from "../types";
    import { resolveRomArt, onThumbErr, DEFAULT_THUMB_SRC, DEFAULT_THUMB_ALT } from "../cartArt";
    import { Emulator } from "../emulator";
    import { selectedRomSha1 } from "stores/windowStores";
    import { closeOverlay } from "stores/overlayStore";
    import { loadAuto, autoSnapVersion } from "../saveStateDb";
    import { formatRelativeTime } from "../relativeTime";
    import { onMount, onDestroy } from "svelte";
    import Icon from "./icons/Icon.svelte";

    let { rom } = $props<{ rom: LibraryRom }>();

    let thumbSrc: string = $state(DEFAULT_THUMB_SRC);
    let thumbAlt: string = $state(DEFAULT_THUMB_ALT);
    let autoThumb: string | undefined = $state(undefined);
    let autoSavedAt: number | undefined = $state(undefined);
    let labelTick = $state(0);
    let tickHandle: ReturnType<typeof setInterval> | undefined;

    $effect(() => {
        const r = rom;
        resolveRomArt(r).then(({ src, alt }) => { thumbSrc = src; thumbAlt = alt; });
    });

    $effect(() => {
        rom.sha1;
        $autoSnapVersion;
        loadAuto(rom.sha1).then(entry => {
            autoThumb = entry?.thumbnail;
            autoSavedAt = entry?.savedAt;
        });
    });

    onMount(() => { tickHandle = setInterval(() => { labelTick++; }, 30_000); });
    onDestroy(() => { if (tickHandle) clearInterval(tickHandle); });

    let autoLabel = $derived.by(() => {
        labelTick;
        return autoSavedAt ? formatRelativeTime(autoSavedAt) : undefined;
    });

    function play(e: MouseEvent) {
        e.stopPropagation();
        closeOverlay();
        if (autoThumb) Emulator.ResumeRom(rom);
        else Emulator.PlayRom(rom);
    }
    function openDetails() {
        selectedRomSha1.set(rom.sha1);
    }
    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectedRomSha1.set(rom.sha1);
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="cp-card"
    role="button"
    tabindex="0"
    onclick={openDetails}
    onkeydown={onKey}
    aria-label="Open {rom.name}"
>
    <div class="cp-thumb-wrap">
        <img class="cp-thumb" src={thumbSrc} alt={thumbAlt} onerror={onThumbErr} loading="lazy" />
        {#if autoThumb}
            <img class="cp-auto-badge" src={autoThumb} alt="Auto-saved" />
        {/if}
        <button class="cp-play" onclick={play} aria-label={autoThumb ? `Resume ${rom.name}` : `Play ${rom.name}`}>
            <Icon name="circle-play" />
        </button>
    </div>
    <div class="cp-title" title={rom.name}>{rom.name}</div>
    {#if autoLabel}
        <div class="cp-auto-label">{autoLabel}</div>
    {/if}
</div>

<style>
    .cp-card {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        width: 130px;
        flex-shrink: 0;
        cursor: pointer;
        border-radius: 0.4em;
        padding: 0.3em;
        transition: background 0.12s;
    }
    .cp-card:hover, .cp-card:focus-visible {
        background: rgba(255,255,255,0.06);
        outline: none;
    }
    .cp-thumb-wrap {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        background: #fff;
        border-radius: 0.35em;
        overflow: hidden;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
    }
    .cp-thumb {
        width: 100%;
        height: 100%;
        object-fit: contain;
        image-rendering: pixelated;
    }
    .cp-play {
        position: absolute;
        inset: 0;
        margin: auto;
        background: rgba(0,0,0,0.45);
        border: none;
        color: #fff;
        font-size: 2.2em;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s;
        border-radius: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    .cp-card:hover .cp-play,
    .cp-card:focus-visible .cp-play {
        opacity: 1;
    }
    .cp-play:hover {
        color: var(--highlight-color, #89b4fa);
    }
    .cp-title {
        font-size: 0.78em;
        color: #cdd6f4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .cp-auto-badge {
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 40%;
        aspect-ratio: 10 / 9;
        object-fit: cover;
        image-rendering: pixelated;
        border-radius: 0.2em;
        box-shadow: 0 1px 4px rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.25);
        background: #111;
    }
    .cp-auto-label {
        font-size: 0.7em;
        color: #888;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
