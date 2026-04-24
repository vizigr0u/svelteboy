<script lang="ts">
    import { onMount } from "svelte";
    import { Emulator } from "../emulator";
    import { loadedCartridge } from "stores/romStores";
    import { DebuggerAttached } from "stores/debugStores";
    import { getAllSlots, quickSaveVersion, type SaveStateEntry } from "../saveStateDb";

    const SLOT_COUNT = 4;

    let slots: (SaveStateEntry | null)[] = $state(Array(SLOT_COUNT).fill(null));

    async function refreshSlots() {
        const cart = $loadedCartridge;
        if (!cart) { slots = Array(SLOT_COUNT).fill(null); return; }
        slots = await getAllSlots(cart.sha1, SLOT_COUNT);
    }

    $effect(() => {
        $loadedCartridge;
        $quickSaveVersion;
        refreshSlots();
    });

    async function onSave(slot: number) {
        await Emulator.QuickSave(slot);
    }

    async function onLoad(slot: number) {
        await Emulator.QuickLoad(slot);
    }

    function formatDate(ts: number): string {
        return new Date(ts).toLocaleTimeString();
    }
</script>

<div class="quicksave-section">
    <div class="disclaimer">
        ⚠ Experimental: quick save/load is buggy and may crash or corrupt state.
    </div>
    <div class="save-slots">
        {#each slots as entry, i (i)}
            {@const slot = i + 1}
            <div class="slot">
                <div class="slot-label">Slot {slot}</div>
                <div class="slot-preview">
                    {#if entry}
                        <img src={entry.thumbnail} alt="Slot {slot}" title={formatDate(entry.savedAt)} />
                    {:else}
                        <span class="empty">Empty</span>
                    {/if}
                </div>
                <div class="slot-actions">
                    <button onclick={() => onSave(slot)} disabled={!$loadedCartridge || $DebuggerAttached}>Save</button>
                    <button onclick={() => onLoad(slot)} disabled={!entry}>Load</button>
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .disclaimer {
        font-size: 0.85em;
        color: #e0a000;
        text-align: center;
        padding: 0.3em 0.5em 0;
    }

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
        min-width: 130px;
        font-size: 0.85em;
    }

    .slot-preview {
        width: 130px;
        height: 117px;
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
        color: #555;
    }

    .slot-label {
        color: #aaa;
    }

    .slot-actions {
        display: flex;
        justify-content: space-around;
        width: 100%;
    }

    .slot-actions button {
        padding: 0.2em 0.4em;
        cursor: pointer;
        width: 40%;
    }

    .slot-actions button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
