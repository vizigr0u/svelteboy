<script lang="ts">
    import type { LibraryRom } from "../types";
    import ContinuePlayingCard from "./ContinuePlayingCard.svelte";

    let { roms } = $props<{ roms: LibraryRom[] }>();
</script>

{#if roms.length > 0}
    <section class="cp-section" aria-label="Continue playing">
        <h2 class="cp-heading">Continue playing</h2>
        <div class="cp-row">
            {#each roms as rom (rom.sha1)}
                <ContinuePlayingCard {rom} />
            {/each}
        </div>
    </section>
{/if}

<style>
    .cp-section {
        padding: 0.3em 0.8em 0.8em;
    }
    .cp-heading {
        margin: 0 0 0.4em;
        font-size: 0.85em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.55);
    }
    .cp-row {
        display: flex;
        gap: 0.4em;
        overflow-x: auto;
        scroll-snap-type: x proximity;
        scrollbar-width: thin;
        padding-bottom: 0.3em;
    }
    .cp-row > :global(*) {
        scroll-snap-align: start;
    }
</style>
