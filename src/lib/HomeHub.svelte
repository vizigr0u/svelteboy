<script lang="ts">
    import RomsSection from "./RomsSection.svelte";
    import BurgerMenu from "./BurgerMenu.svelte";
    import HomeHero from "./HomeHero.svelte";
    import ContinuePlayingRow from "./ContinuePlayingRow.svelte";
    import { libraryStore } from "stores/libraryStore";
    import { loadedCartridge } from "stores/romStores";
    import { goToPlay } from "stores/viewStore";
    import { openPalette } from "stores/paletteStore";
    import { resolveHeroAction } from "./heroAction";
    import { EmulatorInitialized } from "stores/playStores";

    const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    const PALETTE_HINT = IS_MAC ? "⌘K" : "Ctrl+K";

    const CONTINUE_ROW_MAX = 8;

    let menuOpen: boolean = $state(false);
    let heroEl: HTMLDivElement | undefined = $state(undefined);
    let heroVisible: boolean = $state(true);

    const hasRom = $derived($loadedCartridge != undefined);
    const hasResumableSession = $derived(hasRom && $EmulatorInitialized);

    let playedRoms = $derived(
        $libraryStore
            .filter(r => (r.lastPlayedAt ?? 0) > 0)
            .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    );
    let heroRom = $derived(playedRoms[0]);
    let continueRoms = $derived(playedRoms.slice(1, CONTINUE_ROW_MAX + 1));

    let pillRedundant = $derived(resolveHeroAction.pillRedundantWhenHeroVisible({
        heroSha1: heroRom?.sha1,
        loadedSha1: $loadedCartridge?.sha1,
    }));
    let showPill = $derived(hasResumableSession && !(pillRedundant && heroVisible));

    $effect(() => {
        if (!heroEl) return;
        const obs = new IntersectionObserver(
            entries => { heroVisible = entries[0]?.isIntersecting ?? true; },
            { threshold: 0.15 }
        );
        obs.observe(heroEl);
        return () => obs.disconnect();
    });

    function resume() {
        menuOpen = false;
        goToPlay();
    }

    function openCommandPalette() {
        menuOpen = false;
        openPalette();
    }

    const menuItems = $derived([
        ...(hasResumableSession ? [{ label: 'Resume playing', active: false, toggle: resume }] : []),
        { label: 'Commands…', active: false, toggle: openCommandPalette },
    ]);
</script>

<div class="home-hub">
    <header class="home-header">
        <span class="brand">SvelteBoy</span>
        {#if showPill}
            <button class="resume-pill" onclick={resume}>
                ▶ Resume <span class="resume-title">{$loadedCartridge?.name}</span>
            </button>
        {/if}
        <button class="palette-chip" onclick={openPalette} aria-label="Open command palette">
            <span class="palette-chip-icon">⌕</span>
            <kbd>{PALETTE_HINT}</kbd>
        </button>
        {#if menuOpen}
            <div class="menu-backdrop" onclick={() => menuOpen = false} role="presentation" aria-hidden="true"></div>
        {/if}
        <div class="burger-wrap">
            {#if menuOpen}
                <BurgerMenu items={menuItems} />
            {/if}
            <button class="burger-btn" onclick={() => menuOpen = !menuOpen} aria-label="Menu">☰</button>
        </div>
    </header>
    <main class="home-main">
        {#if heroRom}
            <div bind:this={heroEl}>
                <HomeHero rom={heroRom} />
            </div>
            <ContinuePlayingRow roms={continueRoms} />
        {/if}
        <RomsSection />
    </main>
</div>

<style>
    .home-hub {
        min-height: 100dvh;
        background: var(--page-bg, #0f0f17);
        color: var(--text-color);
        display: flex;
        flex-direction: column;
    }

    .home-header {
        display: flex;
        align-items: center;
        gap: 0.8em;
        padding: 0.6em 1em;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid var(--tint-1);
        position: sticky;
        top: 0;
        z-index: 50;
        backdrop-filter: blur(8px);
    }

    .brand {
        font-weight: 700;
        font-size: 1.05em;
        letter-spacing: 0.02em;
    }

    .resume-pill {
        margin-left: auto;
        background: var(--highlight-color);
        color: var(--background-color);
        border: none;
        border-radius: 999px;
        padding: 0.3em 0.9em;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
        max-width: 50vw;
    }
    .resume-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 14em;
        font-weight: 500;
        opacity: 0.85;
    }

    .palette-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35em;
        background: var(--tint-1);
        border: 1px solid var(--tint-2);
        color: rgba(205, 214, 244, 0.75);
        font-size: 0.75em;
        padding: 0.2em 0.55em;
        border-radius: 0.3em;
        cursor: pointer;
        line-height: 1;
    }
    .palette-chip:hover {
        background: rgba(255, 255, 255, 0.1);
        color: inherit;
    }
    .palette-chip-icon { font-size: 1em; opacity: 0.7; }
    .palette-chip kbd {
        font-family: monospace;
        font-size: 0.9em;
        opacity: 0.85;
    }
    .brand ~ .palette-chip:not(.resume-pill + .palette-chip) {
        margin-left: auto;
    }
    @media (pointer: coarse) {
        .palette-chip { display: none; }
    }

    .burger-wrap {
        position: relative;
        margin-left: auto;
        display: flex;
    }
    .palette-chip + .burger-wrap {
        margin-left: 0.5em;
    }
    .burger-btn {
        background: var(--tint-1);
        border: none;
        color: var(--text-color);
        font-size: 1.1em;
        cursor: pointer;
        border-radius: 0.3em;
        padding: 0.15em 0.5em;
        line-height: 1;
    }
    .burger-btn:hover {
        background: var(--tint-3);
    }

    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 199;
    }

    .home-main {
        flex: 1;
        min-height: 0;
    }
</style>
