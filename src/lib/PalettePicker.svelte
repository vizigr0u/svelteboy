<script lang="ts">
    import {
        SelectedPaletteIndex,
        PALETTE_PRESETS,
        PALETTE_NAMES,
    } from "stores/optionsStore";

    let open = $state(false);

    function colorHex(c: number): string {
        const r = (c & 0xff).toString(16).padStart(2, '0');
        const g = ((c >> 8) & 0xff).toString(16).padStart(2, '0');
        const b = ((c >> 16) & 0xff).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    function select(i: number) {
        SelectedPaletteIndex.set(i);
        open = false;
    }
</script>

<div class="palette-picker" class:open>
    <button class="trigger" onclick={() => (open = !open)} aria-haspopup="listbox">
        <div class="swatches">
            {#each PALETTE_PRESETS[$SelectedPaletteIndex] as color}
                <span class="swatch" style="background-color: {colorHex(color)}"></span>
            {/each}
        </div>
        <span class="name">{PALETTE_NAMES[$SelectedPaletteIndex]}</span>
        <span class="arrow">{open ? '▲' : '▼'}</span>
    </button>
    {#if open}
        <ul class="dropdown" role="listbox">
            {#each PALETTE_PRESETS as preset, i}
                <li role="presentation">
                    <button
                        role="option"
                        aria-selected={$SelectedPaletteIndex === i}
                        class:selected={$SelectedPaletteIndex === i}
                        onclick={() => select(i)}
                    >
                        <div class="swatches">
                            {#each preset as color}
                                <span class="swatch" style="background-color: {colorHex(color)}"></span>
                            {/each}
                        </div>
                        <span class="name">{PALETTE_NAMES[i]}</span>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<svelte:window onclick={(e) => {
    if (open && !(e.target as Element)?.closest('.palette-picker')) open = false;
}} />

<style>
    .palette-picker {
        position: relative;
        display: block;
        width: 100%;
    }
    .trigger {
        display: flex;
        align-items: center;
        gap: 1em;
        padding: 3px 6px;
        background: #201f25;
        border: 1px solid #444;
        border-radius: 4px;
        cursor: pointer;
        color: inherit;
        font-size: 0.85em;
        width: 100%;
    }
    .trigger:hover {
        border-color: #666;
    }
    .swatches {
        display: flex;
        gap: 2px;
    }
    .swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 2px;
    }
    .name {
        white-space: nowrap;
    }
    .arrow {
        font-size: 0.7em;
        color: #888;
        margin-left: auto;
    }
    .dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 100;
        margin: 0;
        padding: 4px 0;
        list-style: none;
        background: #201f25;
        border: 1px solid #555;
        border-radius: 4px;
        min-width: 100%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .dropdown button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 0.85em;
        white-space: nowrap;
        width: 100%;
        background: none;
        border: none;
        color: inherit;
        text-align: left;
    }
    .dropdown button:hover {
        background: #2e2d35;
    }
    .dropdown button.selected {
        color: var(--highlight-color, #adf);
    }
</style>
