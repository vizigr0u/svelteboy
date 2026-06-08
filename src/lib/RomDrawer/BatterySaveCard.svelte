<script lang="ts">
    import { batterySaveVersion, deleteBattery, loadBattery, saveBattery, type BatterySaveEntry } from "../../batterySaveDb";
    import { humanReadableSize } from "../../utils";
    import { requestConfirm } from "stores/confirmStore";
    import { showToast } from "stores/toastStore";
    import Icon from "../icons/Icon.svelte";

    let { sha1, name } = $props<{ sha1: string; name: string }>();

    let entry: BatterySaveEntry | undefined = $state(undefined);

    $effect(() => {
        sha1;
        $batterySaveVersion;
        loadBattery(sha1).then(e => { entry = e; });
    });

    function fmt(ts: number): string {
        return new Date(ts).toLocaleString();
    }

    function onExport() {
        if (!entry) return;
        const link = document.createElement('a');
        const blob = new Blob([entry.bytes as BlobPart], { type: 'application/octet-stream' });
        link.href = URL.createObjectURL(blob);
        link.download = name + '.sav';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function onImport(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await saveBattery(sha1, bytes);
        input.value = '';
        showToast('Imported battery save.', 'info');
    }

    async function onDelete() {
        if (!entry) return;
        const ok = await requestConfirm({
            title: 'Delete battery save',
            message: `Remove the battery (SRAM) save for "${name}"? This cannot be undone.`,
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
        });
        if (!ok) return;
        await deleteBattery(sha1);
        showToast('Battery save deleted.', 'info');
    }
</script>

<div class="battery-card">
    <h3>Battery save (SRAM)</h3>
    {#if entry}
        <dl>
            <dt>Saved</dt><dd>{fmt(entry.savedAt)}</dd>
            <dt>Size</dt><dd>{humanReadableSize(entry.bytes.byteLength)}</dd>
        </dl>
        <div class="actions">
            <button onclick={onExport}><Icon name="cloud-arrow-down" /> Export .sav</button>
            <label class="upload">
                <Icon name="cloud-arrow-up" /> Replace…
                <input type="file" accept=".sav,application/octet-stream" onchange={onImport} />
            </label>
            <button class="danger" onclick={onDelete}><Icon name="trash" /> Delete</button>
        </div>
    {:else}
        <p class="empty">No battery save yet. Will be captured automatically while you play.</p>
        <label class="upload">
            <Icon name="cloud-arrow-up" /> Import .sav…
            <input type="file" accept=".sav,application/octet-stream" onchange={onImport} />
        </label>
    {/if}
</div>

<style>
    .battery-card {
        background: #181825;
        border: 1px solid #45475a;
        border-radius: 4px;
        padding: 0.6em 0.75em;
        display: flex;
        flex-direction: column;
        gap: 0.5em;
    }
    h3 { margin: 0; font-size: 0.95em; color: #cdd6f4; }
    dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.25em 0.8em;
        margin: 0;
        font-size: 0.85em;
    }
    dt { color: #888; }
    dd { margin: 0; }
    .actions {
        display: flex;
        gap: 0.4em;
        flex-wrap: wrap;
    }
    .actions button, .actions .upload, .upload {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
        padding: 0.3em 0.6em;
        background: #2a2a3a;
        border: 1px solid #45475a;
        border-radius: 3px;
        color: inherit;
        cursor: pointer;
        font-size: 0.85em;
    }
    .actions button:hover, .upload:hover {
        background: #34344a;
    }
    .upload input { display: none; }
    .danger { color: #f38ba8; }
    .danger:hover { background: rgba(243, 139, 168, 0.12); }
    .empty {
        margin: 0;
        font-style: italic;
        color: #888;
        font-size: 0.85em;
    }
</style>
