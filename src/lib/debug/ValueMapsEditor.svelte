<script lang="ts">
    import { ValueMaps } from "stores/debugStores";
    import type { ValueMap } from "../../types";

    let expanded: boolean = $state(false);
    let editingIndex: number | null = $state(null);
    let newMapName: string = $state("");
    let newEntryValue: string = $state("");
    let newEntryName: string = $state("");

    function parseValueStr(s: string): number | undefined {
        const trimmed = s.trim();
        if (trimmed.length === 0) return undefined;
        const isHex = /^0x/i.test(trimmed) || /^\$/.test(trimmed);
        const stripped = trimmed.replace(/^0x/i, "").replace(/^\$/, "");
        const v = parseInt(stripped, isHex ? 16 : 10);
        if (isNaN(v) || v < 0 || v > 0xffffffff) return undefined;
        return v;
    }

    function addMap() {
        const name = newMapName.trim();
        if (name.length === 0) return;
        if ($ValueMaps.some((m) => m.name === name)) return;
        $ValueMaps = [...$ValueMaps, { name, entries: {} }];
        newMapName = "";
    }

    function removeMap(index: number) {
        if (editingIndex === index) editingIndex = null;
        $ValueMaps = $ValueMaps.filter((_, i) => i !== index);
    }

    function addEntry(mapIndex: number) {
        const v = parseValueStr(newEntryValue);
        const label = newEntryName.trim();
        if (v === undefined || label.length === 0) return;
        const next = [...$ValueMaps];
        next[mapIndex] = {
            ...next[mapIndex],
            entries: { ...next[mapIndex].entries, [v.toString()]: label },
        };
        $ValueMaps = next;
        newEntryValue = "";
        newEntryName = "";
    }

    function removeEntry(mapIndex: number, key: string) {
        const next = [...$ValueMaps];
        const entries = { ...next[mapIndex].entries };
        delete entries[key];
        next[mapIndex] = { ...next[mapIndex], entries };
        $ValueMaps = next;
    }

    function sortedEntries(map: ValueMap): [string, string][] {
        return Object.entries(map.entries).sort(
            (a, b) => parseInt(a[0]) - parseInt(b[0]),
        );
    }
</script>

<div class="value-maps-section">
    <button
        class="header-toggle"
        type="button"
        onclick={() => (expanded = !expanded)}
    >
        <span class="caret">{expanded ? "▼" : "▶"}</span>
        Value Maps ({$ValueMaps.length})
    </button>

    {#if expanded}
        <div class="maps-body">
            <form
                class="add-map-form"
                onsubmit={(e) => {
                    e.preventDefault();
                    addMap();
                }}
            >
                <input
                    type="text"
                    bind:value={newMapName}
                    placeholder="new map name"
                />
                <button
                    type="submit"
                    disabled={newMapName.trim().length === 0}>+ Map</button
                >
            </form>

            {#each $ValueMaps as map, mi (map.name)}
                <div class="map-card">
                    <div class="map-header">
                        <strong>{map.name}</strong>
                        <span class="entry-count"
                            >{Object.keys(map.entries).length} entries</span
                        >
                        <button
                            type="button"
                            onclick={() =>
                                (editingIndex =
                                    editingIndex === mi ? null : mi)}
                        >
                            {editingIndex === mi ? "Close" : "Edit"}
                        </button>
                        <button
                            class="remove-button"
                            type="button"
                            onclick={() => removeMap(mi)}
                            title="Delete map">X</button
                        >
                    </div>

                    {#if editingIndex === mi}
                        <div class="entries-list">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Value</th>
                                        <th>Name</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each sortedEntries(map) as [key, label] (key)}
                                        <tr>
                                            <td class="mono"
                                                >0x{parseInt(key)
                                                    .toString(16)
                                                    .padStart(2, "0")}
                                                ({key})</td
                                            >
                                            <td>{label}</td>
                                            <td
                                                ><button
                                                    class="remove-button"
                                                    type="button"
                                                    onclick={() =>
                                                        removeEntry(
                                                            mi,
                                                            key,
                                                        )}>X</button
                                                ></td
                                            >
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                        <form
                            class="add-entry-form"
                            onsubmit={(e) => {
                                e.preventDefault();
                                addEntry(mi);
                            }}
                        >
                            <input
                                type="text"
                                bind:value={newEntryValue}
                                placeholder="value (hex/dec)"
                            />
                            <input
                                type="text"
                                bind:value={newEntryName}
                                placeholder="name"
                            />
                            <button
                                type="submit"
                                disabled={parseValueStr(newEntryValue) ===
                                    undefined ||
                                    newEntryName.trim().length === 0}
                                >+ Entry</button
                            >
                        </form>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .value-maps-section {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        margin-top: 0.5em;
        align-items: stretch;
    }
    .header-toggle {
        background: none;
        border: 1px solid #444;
        color: inherit;
        cursor: pointer;
        padding: 0.3em 0.6em;
        font-size: 1em;
        text-align: left;
    }
    .caret {
        display: inline-block;
        width: 1em;
    }
    .maps-body {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        padding: 0.4em;
    }
    .add-map-form,
    .add-entry-form {
        display: flex;
        gap: 0.3em;
    }
    .map-card {
        border: 1px solid #444;
        padding: 0.4em;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
    }
    .map-header {
        display: flex;
        align-items: center;
        gap: 0.6em;
    }
    .entry-count {
        color: #888;
        font-size: 0.85em;
    }
    .entries-list {
        max-height: 14em;
        overflow-y: auto;
    }
    .entries-list table {
        border-collapse: collapse;
        width: 100%;
        font-size: 0.85em;
    }
    .entries-list th,
    .entries-list td {
        padding: 0.15em 0.5em;
        border-bottom: 1px solid #333;
        text-align: left;
    }
    .mono {
        font-family: monospace;
        color: #aaa;
    }
    .remove-button {
        border-radius: 25%;
        font-weight: 600;
        background-color: #4c4c4c;
        color: #c7c7c7;
        height: 1.6em;
        width: 1.6em;
        padding: 0;
        border-width: 2px;
    }
    .remove-button:hover {
        color: #ce6666;
        border-color: #b22a2a;
    }
</style>
