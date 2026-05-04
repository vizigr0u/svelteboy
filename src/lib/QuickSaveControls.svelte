<script lang="ts">
    import { Emulator } from "../emulator";
    import { loadedCartridge } from "stores/romStores";
    import { DebuggerAttached } from "stores/debugStores";
    import {
        getAllSlots,
        isValidSaveStateBlob,
        quickSaveVersion,
        saveSlot,
        type SaveStateEntry,
    } from "../saveStateDb";
    import Icon from "./icons/Icon.svelte";

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

    function onDownload(slot: number) {
        const entry = slots[slot - 1];
        const cart = $loadedCartridge;
        if (!entry || !cart) return;
        const link = document.createElement("a");
        const blob = new Blob([entry.state as BlobPart], {
            type: "application/octet-stream",
        });
        link.href = URL.createObjectURL(blob);
        link.download = `${cart.name}-slot${slot}.svby`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function onUpload(slot: number, event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const cart = $loadedCartridge;
        if (!cart) return;
        const buffer = await file.arrayBuffer();
        const state = new Uint8Array(buffer);
        if (!isValidSaveStateBlob(state)) {
            input.value = "";
            alert(`${file.name}: not a valid .svby save state (bad magic).`);
            return;
        }
        await saveSlot(cart.sha1, slot, { state, savedAt: Date.now() });
        input.value = "";
    }

    function formatDate(ts: number): string {
        return new Date(ts).toLocaleTimeString();
    }
</script>

<div class="quicksave-section">
    <div class="save-slots">
        {#each slots as entry, i (i)}
            {@const slot = i + 1}
            <div class="slot">
                <div class="slot-label">Slot {slot}</div>
                <div class="slot-preview">
                    {#if entry && entry.thumbnail}
                        <img src={entry.thumbnail} alt="Slot {slot}" title={formatDate(entry.savedAt)} />
                    {:else if entry}
                        <span class="empty" title={formatDate(entry.savedAt)}>Imported</span>
                    {:else}
                        <span class="empty">Empty</span>
                    {/if}
                </div>
                <div class="slot-actions">
                    <button onclick={() => onSave(slot)} disabled={!$loadedCartridge || $DebuggerAttached}>Save</button>
                    <button onclick={() => onLoad(slot)} disabled={!entry}>Load</button>
                </div>
                <div class="slot-io">
                    <button
                        aria-label="Download .svby"
                        title="Download .svby"
                        onclick={() => onDownload(slot)}
                        disabled={!entry}
                    ><Icon name="cloud-arrow-down" /></button>
                    <label
                        class="upload-btn"
                        title="Upload .svby"
                        class:disabled={!$loadedCartridge}
                    >
                        <Icon name="cloud-arrow-up" />
                        <input
                            type="file"
                            accept=".svby,application/octet-stream"
                            disabled={!$loadedCartridge}
                            onchange={(e) => onUpload(slot, e)}
                        />
                    </label>
                </div>
            </div>
        {/each}
    </div>
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

    .slot-io {
        display: flex;
        justify-content: space-around;
        width: 100%;
        gap: 0.25em;
    }

    .slot-io button,
    .slot-io .upload-btn {
        padding: 0.2em 0.4em;
        cursor: pointer;
        width: 40%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 3px;
        color: inherit;
        font-size: 0.9em;
        line-height: 1;
        box-sizing: border-box;
    }

    .slot-io button:hover:not(:disabled),
    .slot-io .upload-btn:not(.disabled):hover {
        background: #333;
    }

    .slot-io .upload-btn input {
        display: none;
    }

    .slot-io .upload-btn.disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .slot-io button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .slot-actions button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
