<script lang="ts">
    import { Emulator } from "../emulator";
    import { loadedCartridge } from "stores/romStores";
    import { DebuggerAttached } from "stores/debugStores";
    import { getAllSlots, quickSaveVersion, type SaveStateEntry } from "../saveStateDb";

    let { slotCount = 9, onaction }: { slotCount?: number; onaction?: () => void } = $props();

    let slots: (SaveStateEntry | null)[] = $state([]);
    let cart = $derived($loadedCartridge);

    async function refreshSlots() {
        if (!cart) { slots = []; return; }
        slots = await getAllSlots(cart.sha1, slotCount);
    }

    $effect(() => {
        cart;
        slotCount;
        $quickSaveVersion;
        refreshSlots();
    });

    async function onSlotClick(slot: number) {
        const entry = slots[slot - 1];
        if (entry) await Emulator.QuickLoad(slot);
        else {
            if (!cart || $DebuggerAttached) return;
            await Emulator.QuickSave(slot);
        }
        onaction?.();
    }
</script>

<div class="slot-panel" role="group" aria-label="Quick save slots">
    {#each Array(slotCount) as _, i (i)}
        {@const slot = i + 1}
        {@const entry = slots[i]}
        <button
            class="slot"
            class:filled={!!entry}
            disabled={!cart || (!entry && $DebuggerAttached)}
            onclick={() => onSlotClick(slot)}
            title={entry ? `Load slot ${slot} — ${new Date(entry.savedAt).toLocaleString()}` : `Save to slot ${slot}`}
            aria-label={entry ? `Load slot ${slot}` : `Save to slot ${slot}`}
        >
            {#if entry?.thumbnail}
                <img src={entry.thumbnail} alt="Slot {slot}" />
            {:else if entry}
                <span class="placeholder">{slot}</span>
            {:else}
                <span class="placeholder empty">+</span>
            {/if}
            <span class="slot-number">{slot}</span>
        </button>
    {/each}
</div>

<style>
    .slot-panel {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.4em;
    }
    .slot {
        position: relative;
        background: var(--section-bg-color);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 0.3em;
        padding: 0;
        aspect-ratio: 10 / 9;
        overflow: hidden;
        cursor: pointer;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .slot:hover:not(:disabled) {
        border-color: var(--highlight-color);
    }
    .slot:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .slot.filled {
        background: #1a1a2a;
    }
    .slot img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        image-rendering: pixelated;
    }
    .placeholder {
        font-size: 1.5em;
        color: rgba(255,255,255,0.35);
        font-family: monospace;
    }
    .placeholder.empty {
        color: rgba(255,255,255,0.25);
        font-size: 2em;
    }
    .slot-number {
        position: absolute;
        top: 2px;
        left: 4px;
        font-size: 0.7em;
        font-family: monospace;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.9);
        pointer-events: none;
    }
</style>
