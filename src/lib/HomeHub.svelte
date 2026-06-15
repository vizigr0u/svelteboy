<script lang="ts">
    import RomsSection from "./RomsSection.svelte";
    import HomeHero from "./HomeHero.svelte";
    import ContinuePlayingRow from "./ContinuePlayingRow.svelte";
    import { libraryStore } from "stores/libraryStore";
    import { loadedCartridge } from "stores/romStores";

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

    .home-main {
        flex: 1;
        min-height: 0;
    }
</style>
