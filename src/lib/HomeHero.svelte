<script lang="ts">
    import type { LibraryRom } from "../types";
    import { resolveRomArt, onThumbErr, DEFAULT_THUMB_SRC, DEFAULT_THUMB_ALT } from "../cartArt";
    import { CartType, cartTypeFromCgbFlag, cartTypeLabel } from "../cartType";
    import { humanReadableSize } from "../utils";
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

    let cartType = $derived(cartTypeFromCgbFlag(rom.cgbFlag));
    let cartLabel = $derived(cartTypeLabel(cartType));
    let cartBadgeClass = $derived(
        cartType === CartType.CGB_ONLY ? "badge-cgb"
        : cartType === CartType.MIXED ? "badge-mixed"
        : "badge-gb"
    );
    let sizeLabel = $derived(rom.fileSize != null ? humanReadableSize(rom.fileSize) : undefined);
    let lastPlayedLabel = $derived(formatLastPlayed(rom.lastPlayedAt));

    function formatLastPlayed(ts: number | undefined): string {
        if (!ts) return "Never played";
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1) return "Moments ago";
        if (m < 60) return `${m} min ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} hr ago`;
        const d = Math.floor(h / 24);
        if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
        return new Date(ts).toLocaleDateString();
    }

    function resume() {
        Emulator.PlayRom(rom);
    }

    function openDetails() {
        selectedRomSha1.set(rom.sha1);
    }
</script>

<section class="hero" aria-label="Continue playing">
    <div class="hero-art" style="background-image: url({thumbSrc});" aria-hidden="true"></div>
    <div class="hero-art-scrim" aria-hidden="true"></div>
    <div class="hero-content">
        <img class="hero-thumb" src={thumbSrc} alt={thumbAlt} onerror={onThumbErr} />
        <div class="hero-text">
            <div class="hero-eyebrow">Last played · {lastPlayedLabel}</div>
            <h1 class="hero-title">{rom.name}</h1>
            <div class="hero-chips">
                <span class="chip cart-badge {cartBadgeClass}">{cartLabel}</span>
                {#if rom.mbcKind && rom.mbcKind !== 'none'}
                    <span class="chip chip-mbc">{rom.mbcKind.toUpperCase()}</span>
                {/if}
                {#if rom.hasRtc}<span class="chip"><Icon name="clock" /> RTC</span>{/if}
                {#if rom.hasBattery}<span class="chip"><Icon name="battery" /> BATT</span>{/if}
                {#if sizeLabel}<span class="chip chip-size">{sizeLabel}</span>{/if}
            </div>
            <div class="hero-actions">
                <button class="cta-primary" onclick={resume}>
                    <Icon name="circle-play" /> Resume
                </button>
                <button class="cta-secondary" onclick={openDetails}>Details</button>
            </div>
        </div>
    </div>
</section>

<style>
    .hero {
        position: relative;
        overflow: hidden;
        border-radius: 0.6em;
        margin: 0.8em;
        min-height: 220px;
        background: #1a1a25;
        isolation: isolate;
    }
    .hero-art {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        filter: blur(28px) saturate(1.1) brightness(0.55);
        transform: scale(1.15);
        z-index: 0;
    }
    .hero-art-scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%);
        z-index: 1;
    }
    .hero-content {
        position: relative;
        z-index: 2;
        display: flex;
        gap: 1.2em;
        padding: 1.2em;
        align-items: center;
    }
    .hero-thumb {
        width: 120px;
        height: 120px;
        object-fit: contain;
        background: white;
        border-radius: 0.4em;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        flex-shrink: 0;
        image-rendering: pixelated;
    }
    .hero-text {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        min-width: 0;
        flex: 1;
    }
    .hero-eyebrow {
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.65);
    }
    .hero-title {
        margin: 0;
        font-size: 1.6em;
        font-weight: 700;
        color: #fff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .hero-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3em;
        margin: 0.2em 0;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25em;
        padding: 0.1em 0.5em;
        font-size: 0.72em;
        font-weight: 600;
        letter-spacing: 0.04em;
        background: rgba(255, 255, 255, 0.12);
        color: #f3f3f3;
        border-radius: 0.25em;
    }
    .chip-mbc { font-family: ui-monospace, monospace; background: rgba(255,255,255,0.18); }
    .chip-size { background: rgba(255,255,255,0.08); color: #d0d0d0; }
    .cart-badge.badge-gb { background: #4a5568; color: #e2e8f0; }
    .cart-badge.badge-mixed { background: #5e548e; color: #f4f0fa; }
    .cart-badge.badge-cgb { background: #d65f5f; color: #fff; }

    .hero-actions {
        display: flex;
        gap: 0.6em;
        margin-top: 0.4em;
    }
    .cta-primary {
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
        border: none;
        border-radius: 999px;
        padding: 0.55em 1.4em;
        font-size: 0.95em;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
    }
    .cta-primary:hover {
        filter: brightness(1.1);
    }
    .cta-secondary {
        background: rgba(255,255,255,0.1);
        color: #f3f3f3;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 999px;
        padding: 0.55em 1.1em;
        font-size: 0.9em;
        cursor: pointer;
    }
    .cta-secondary:hover {
        background: rgba(255,255,255,0.18);
    }

    @media (max-width: 600px) {
        .hero-content {
            flex-direction: column;
            align-items: flex-start;
            padding: 1em;
        }
        .hero-thumb {
            width: 96px;
            height: 96px;
            align-self: center;
        }
        .hero-title {
            font-size: 1.3em;
            white-space: normal;
        }
    }
</style>
