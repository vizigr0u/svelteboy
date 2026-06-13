<script lang="ts">
    import { Emulator } from "../../emulator";
    import { loadedCartridge } from "stores/romStores";
    import { DebuggerAttached } from "stores/debugStores";
    import {
        getAllSlots,
        isValidSaveStateBlob,
        quickSaveVersion,
        saveSlot,
        type SaveStateEntry,
    } from "../../saveStateDb";
    import Icon from "../icons/Icon.svelte";

    let { sha1, name, slotCount = 9 } = $props<{
        sha1: string;
        name: string;
        slotCount?: number;
    }>();

    let slots: (SaveStateEntry | null)[] = $state([]);

    async function refreshSlots() {
        slots = await getAllSlots(sha1, slotCount);
    }

    $effect(() => {
        sha1;
        slotCount;
        $quickSaveVersion;
        refreshSlots();
    });

    let isLoaded = $derived($loadedCartridge?.sha1 === sha1);

    async function onSave(slot: number) {
        if (!isLoaded) return;
        await Emulator.QuickSave(slot);
    }

    async function onLoad(slot: number) {
        if (!isLoaded) return;
        await Emulator.QuickLoad(slot);
    }

    function onDownload(slot: number) {
        const entry = slots[slot - 1];
        if (!entry) return;
        const link = document.createElement("a");
        const blob = new Blob([entry.state as BlobPart], {
            type: "application/octet-stream",
        });
        link.href = URL.createObjectURL(blob);
        link.download = `${name}-slot${slot}.svby`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function onUpload(slot: number, event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        const state = new Uint8Array(buffer);
        if (!isValidSaveStateBlob(state)) {
            input.value = "";
            alert(`${file.name}: not a valid .svby save state (bad magic).`);
            return;
        }
        await saveSlot(sha1, slot, { state, savedAt: Date.now() });
        input.value = "";
    }

    function formatDate(ts: number): string {
        return new Date(ts).toLocaleString();
    }
</script>

{#if !isLoaded}
    <p class="hint">Load this ROM to capture new quick saves. Existing slots are visible below.</p>
{/if}
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
                <button onclick={() => onSave(slot)} disabled={!isLoaded || $DebuggerAttached}>Save</button>
                <button onclick={() => onLoad(slot)} disabled={!isLoaded || !entry}>Load</button>
            </div>
            <div class="slot-io">
                <button
                    aria-label="Download .svby"
                    title="Download .svby"
                    onclick={() => onDownload(slot)}
                    disabled={!entry}
                ><Icon name="cloud-arrow-down" /></button>
                <label class="upload-btn" title="Upload .svby">
                    <Icon name="cloud-arrow-up" />
                    <input
                        type="file"
                        accept=".svby,application/octet-stream"
                        onchange={(e) => onUpload(slot, e)}
                    />
                </label>
            </div>
        </div>
    {/each}
</div>

<style>
    .hint {
        font-size: 0.85em;
        color: var(--muted-color);
        font-style: italic;
        margin: 0.5em 0;
    }
    .save-slots {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 0.5em;
        padding: 0.5em 0;
    }
    .slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25em;
        background: var(--background-color);
        border-radius: 4px;
        padding: 0.4em;
        font-size: 0.85em;
    }
    .slot-preview {
        width: 100%;
        aspect-ratio: 10 / 9;
        background: var(--section-bg-color);
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
        color: var(--muted-color);
    }
    .slot-label {
        color: #aaa;
    }
    .slot-actions, .slot-io {
        display: flex;
        justify-content: space-around;
        width: 100%;
        gap: 0.25em;
    }
    .slot-actions button, .slot-io button, .slot-io .upload-btn {
        padding: 0.2em 0.4em;
        cursor: pointer;
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #2a2a2a;
        border: 1px solid var(--border-color);
        border-radius: 3px;
        color: inherit;
        font-size: 0.9em;
    }
    .slot-actions button:hover:not(:disabled),
    .slot-io button:hover:not(:disabled),
    .slot-io .upload-btn:hover {
        background: var(--panel-color);
    }
    .slot-io .upload-btn input {
        display: none;
    }
    .slot-actions button:disabled, .slot-io button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
