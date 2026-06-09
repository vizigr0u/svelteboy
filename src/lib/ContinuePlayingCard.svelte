<script lang="ts">
    import type { LibraryRom } from "../types";
    import { resolveRomArt, onThumbErr, DEFAULT_THUMB_SRC, DEFAULT_THUMB_ALT } from "../cartArt";
    import { Emulator } from "../emulator";
    import { selectedRomSha1 } from "stores/windowStores";
    import Icon from "./icons/Icon.svelte";

    let { rom } = $props<{ rom: LibraryRom }>();

    let thumbSrc: string = $state(DEFAULT_THUMB_SRC);
    let thumbAlt: string = $state(DEFAULT_THUMB_ALT);

    $effect(() => {
        const r = rom;
        resolveRomArt(r).then(({ src, alt }) => { thumbSrc = src; thumbAlt = alt; });
    });

    function play(e: MouseEvent) {
        e.stopPropagation();
        Emulator.PlayRom(rom);
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
        <button class="cp-play" onclick={play} aria-label="Play {rom.name}">
            <Icon name="circle-play" />
        </button>
    </div>
    <div class="cp-title" title={rom.name}>{rom.name}</div>
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
</style>
