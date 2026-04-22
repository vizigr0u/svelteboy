<script lang="ts">
    import { onMount } from "svelte";
    import { Emulator } from "../emulator";
    import { loadedCartridge } from "stores/romStores";
    import { getAllSlots, type SaveStateEntry } from "../saveStateDb";

    const SLOT_COUNT = 4;

    let slots: (SaveStateEntry | null)[] = $state(Array(SLOT_COUNT).fill(null));

    async function refreshSlots() {
        const cart = $loadedCartridge;
        if (!cart) { slots = Array(SLOT_COUNT).fill(null); return; }
        slots = await getAllSlots(cart.sha1, SLOT_COUNT);
    }

    $effect(() => {
        $loadedCartridge;
        refreshSlots();
    });

    async function onSave(slot: number) {
        await Emulator.QuickSave(slot);
        await refreshSlots();
    }

    async function onLoad(slot: number) {
        await Emulator.QuickLoad(slot);
    }

    function formatDate(ts: number): string {
        return new Date(ts).toLocaleTimeString();
    }
</script>

<div class="save-slots">
    {#each Array(SLOT_COUNT) as _, i}
        {@const slot = i + 1}
        {@const entry = slots[i]}
        <div class="slot">
            <div class="slot-preview">
                {#if entry}
                    <img src={entry.thumbnail} alt="Slot {slot}" title={formatDate(entry.savedAt)} />
                {:else}
                    <span class="empty">Empty</span>
                {/if}
            </div>
            <div class="slot-label">Slot {slot}</div>
            <div class="slot-actions">
                <button onclick={() => onSave(slot)} disabled={!$loadedCartridge}>Save</button>
                <button onclick={() => onLoad(slot)} disabled={!entry}>Load</button>
            </div>
        </div>
    {/each}
</div>

<style>
    .save-slots {
        display: flex;
        gap: 0.5em;
        padding: 0.5em;
        flex-wrap: wrap;
        justify-content: center;
    }

    .slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25em;
        background: #222;
        border-radius: 4px;
        padding: 0.4em;
        min-width: 80px;
    }

    .slot-preview {
        width: 80px;
        height: 72px;
        background: #111;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .slot-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        image-rendering: pixelated;
    }

    .empty {
        font-size: 0.6em;
        color: #555;
    }

    .slot-label {
        font-size: 0.65em;
        color: #aaa;
    }

    .slot-actions {
        display: flex;
        gap: 0.25em;
    }

    .slot-actions button {
        font-size: 0.65em;
        padding: 0.2em 0.4em;
        cursor: pointer;
    }

    .slot-actions button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
