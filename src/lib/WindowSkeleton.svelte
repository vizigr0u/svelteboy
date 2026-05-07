<script lang="ts">
    interface Props {
        label?: string;
        rows?: ReadonlyArray<number | ReadonlyArray<number>>;
    }

    const DEFAULT_ROWS: ReadonlyArray<number | ReadonlyArray<number>> = [
        8,
        [4, 4],
        4,
    ];

    let { label = "Loading…", rows = DEFAULT_ROWS }: Props = $props();
</script>

<div class="skeleton" aria-busy="true" aria-live="polite">
    <div class="skeleton-bar"></div>
    {#each rows as row}
        {#if Array.isArray(row)}
            <div class="skeleton-row">
                {#each row as h}
                    <div class="skeleton-block" style:height="{h}em"></div>
                {/each}
            </div>
        {:else}
            <div class="skeleton-block" style:height="{row}em"></div>
        {/if}
    {/each}
    <span class="skeleton-label">{label}</span>
</div>

<style>
    .skeleton {
        display: flex;
        flex-direction: column;
        gap: 0.6em;
        padding: 0.75em;
    }

    .skeleton-row {
        display: flex;
        gap: 0.6em;
    }

    .skeleton-row > .skeleton-block {
        flex: 1;
    }

    .skeleton-bar,
    .skeleton-block {
        background: linear-gradient(
            90deg,
            #2a2a3a 0%,
            #3a3a4f 50%,
            #2a2a3a 100%
        );
        background-size: 200% 100%;
        border-radius: 0.3em;
        animation: skeleton-shimmer 1.2s linear infinite;
    }

    .skeleton-bar {
        height: 1.6em;
        width: 30%;
    }

    .skeleton-label {
        align-self: center;
        color: #9aa0b3;
        font-size: 0.85em;
        font-style: italic;
    }

    @keyframes skeleton-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
</style>
