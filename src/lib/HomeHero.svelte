<script lang="ts">
    import type { LibraryRom } from "../types";
    import { resolveRomArt, onThumbErr, DEFAULT_THUMB_SRC, DEFAULT_THUMB_ALT } from "../cartArt";
    import { CartType, cartTypeFromCgbFlag, cartTypeLabel } from "../cartType";
    import { humanReadableSize } from "../utils";
    import { formatRelativeTime } from "../relativeTime";
    import { Emulator } from "../emulator";
    import { romMenuTrigger } from "./romMenuAction";
    import { loadedCartridge } from "stores/romStores";
    import { EmulatorInitialized } from "stores/playStores";
    import { goToPlay } from "stores/viewStore";
    import { loadAuto, autoSnapVersion } from "../saveStateDb";
    import { resolveHeroAction } from "./heroAction";
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

    let cartType = $derived(cartTypeFromCgbFlag(rom.cgbFlag));
    let cartLabel = $derived(cartTypeLabel(cartType));
    let cartBadgeClass = $derived(
        cartType === CartType.CGB_ONLY ? "badge-cgb"
        : cartType === CartType.MIXED ? "badge-mixed"
        : "badge-gb"
    );
    let sizeLabel = $derived(rom.fileSize != null ? humanReadableSize(rom.fileSize) : undefined);
    let lastPlayedLabel = $derived.by(() => {
        labelTick;
        return rom.lastPlayedAt ? formatRelativeTime(rom.lastPlayedAt) : 'Never played';
    });
    let autoLabel = $derived.by(() => {
        labelTick;
        return autoSavedAt ? formatRelativeTime(autoSavedAt) : undefined;
    });

    let action = $derived(resolveHeroAction({
        heroSha1: rom.sha1,
        loadedSha1: $loadedCartridge?.sha1,
        emulatorInitialized: $EmulatorInitialized,
        hasAutoSnap: !!autoThumb,
    }));
    let isLiveSession = $derived(!!$loadedCartridge && $loadedCartridge.sha1 === rom.sha1 && $EmulatorInitialized);
    let isResume = $derived(action === 'resume');
    let primaryLabel = $derived(isResume ? 'Resume' : 'Play');
    let primaryHint = $derived(isResume ? 'Continue session' : undefined);

    function primary() {
        if (action === 'resume') {
            if (isLiveSession) {
                goToPlay();
                return;
            }
            Emulator.ResumeRom(rom).then(() => goToPlay());
            return;
        }
        Emulator.PlayRom(rom);
    }

    function restart() {
        Emulator.PlayRom(rom, { purgeAutoOnLoad: true });
    }
</script>

<section class="hero" aria-label="Continue playing" use:romMenuTrigger={rom}>
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
            {#if autoThumb && !isLiveSession}
                <div class="autosnap-strip" title="Auto-saved session">
                    <img class="autosnap-thumb" src={autoThumb} alt="Auto-saved session" />
                    <span class="autosnap-label">Auto-saved {autoLabel}</span>
                </div>
            {/if}
            <div class="hero-actions">
                <button class="cta-primary" onclick={primary} title={primaryHint}>
                    <Icon name="circle-play" /> {primaryLabel}
                </button>
                {#if isResume}
                    <button class="cta-secondary" role="menuitem" onclick={restart}><Icon name="rotate" /> Restart</button>
                {/if}
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
        box-shadow: 0 6px 20px var(--scrim);
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
        background: var(--tint-3);
        color: #f3f3f3;
        border-radius: 0.25em;
    }
    .chip-mbc { font-family: ui-monospace, monospace; background: rgba(255,255,255,0.18); }
    .chip-size { background: var(--tint-2); color: #d0d0d0; }
    .cart-badge.badge-gb { background: #4a5568; color: #e2e8f0; }
    .cart-badge.badge-mixed { background: #5e548e; color: #f4f0fa; }
    .cart-badge.badge-cgb { background: #d65f5f; color: #fff; }

    .autosnap-strip {
        display: flex;
        align-items: center;
        gap: 0.5em;
        margin: 0.3em 0 0;
    }
    .autosnap-thumb {
        width: 56px;
        height: 50.4px;
        object-fit: contain;
        image-rendering: pixelated;
        background: var(--section-bg-color);
        border-radius: 0.25em;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
    .autosnap-label {
        font-size: 0.78em;
        color: rgba(255,255,255,0.75);
    }
    .hero-actions {
        display: flex;
        gap: 0.6em;
        margin-top: 0.4em;
    }
    .cta-primary {
        background: var(--highlight-color);
        color: var(--background-color);
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
    .cta-tertiary {
        background: transparent;
        color: rgba(255,255,255,0.6);
        border: none;
        padding: 0.55em 0.6em;
        font-size: 0.82em;
        cursor: pointer;
        text-decoration: underline;
        text-decoration-color: rgba(255,255,255,0.25);
        text-underline-offset: 0.2em;
    }
    .cta-tertiary:hover {
        color: rgba(255,255,255,0.9);
        text-decoration-color: rgba(255,255,255,0.6);
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
