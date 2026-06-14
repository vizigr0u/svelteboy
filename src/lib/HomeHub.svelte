<script lang="ts">
    import RomsSection from "./RomsSection.svelte";
    import HomeHero from "./HomeHero.svelte";
    import ContinuePlayingRow from "./ContinuePlayingRow.svelte";
    import { libraryStore } from "stores/libraryStore";
    import { loadedCartridge } from "stores/romStores";
    import { openPalette } from "stores/paletteStore";
    import { openOverlay } from "stores/overlayStore";

    const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    const PALETTE_HINT = IS_MAC ? "⌘K" : "Ctrl+K";

    const CONTINUE_ROW_MAX = 8;

    let playedRoms = $derived(
        $libraryStore
            .filter(r => (r.lastPlayedAt ?? 0) > 0)
            .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    );
    // Pin the live session as the hero when one is loaded.
    let heroRom = $derived.by(() => {
        const live = $loadedCartridge
            ? $libraryStore.find(r => r.sha1 === $loadedCartridge!.sha1)
            : undefined;
        return live ?? playedRoms[0];
    });
    let continueRoms = $derived(
        playedRoms.filter(r => r.sha1 !== heroRom?.sha1).slice(0, CONTINUE_ROW_MAX)
    );
</script>

<div class="home-hub">
    <header class="home-header">
        <span class="brand">SvelteBoy</span>
        <button class="palette-chip" onclick={openPalette} aria-label="Open command palette">
            <span class="palette-chip-icon">⌕</span>
            <kbd>{PALETTE_HINT}</kbd>
        </button>
        <button class="gear-btn" onclick={() => openOverlay('options')} aria-label="Options">⚙</button>
    </header>
    <main class="home-main">
        {#if heroRom}
            <HomeHero rom={heroRom} />
            <ContinuePlayingRow roms={continueRoms} />
        {/if}
        <RomsSection />
    </main>
</div>

<style>
    .home-hub {
        min-height: 100dvh;
        background: var(--page-bg, #0f0f17);
        color: var(--text-color, #cdd6f4);
        display: flex;
        flex-direction: column;
    }

    .home-header {
        display: flex;
        align-items: center;
        gap: 0.8em;
        padding: 0.6em 1em;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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

    .palette-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35em;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
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
    .palette-chip { margin-left: auto; }
    @media (pointer: coarse) {
        .palette-chip { display: none; }
        .palette-chip + .gear-btn { margin-left: auto; }
    }

    .gear-btn {
        background: rgba(255, 255, 255, 0.06);
        border: none;
        color: var(--text-color, #cdd6f4);
        font-size: 1.2em;
        cursor: pointer;
        border-radius: 0.3em;
        padding: 0.1em 0.4em;
        line-height: 1;
    }
    .gear-btn:hover {
        background: rgba(255, 255, 255, 0.12);
    }

    .home-main {
        flex: 1;
        min-height: 0;
    }
</style>
