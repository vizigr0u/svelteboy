<script lang="ts">
    import { hexDump, writeMemory } from "../../../build/backend";
    import {
        Cheats,
        DebuggerAttached,
        GbDebugInfoStore,
        ValueMaps,
    } from "stores/debugStores";
    import type { CheatWatch, ValueMap } from "../../types";
    import { uToHex16 } from "../../utils";

    const MIN_SIZE = 1;
    const MAX_SIZE = 4;

    let nameInput: string = $state("");
    let addressInput: string = $state("");
    let sizeInput: number = $state(1);

    let editingIndex: number | null = $state(null);
    let editingDraft: string = $state("");

    function clampSize(n: number): number {
        if (!Number.isFinite(n)) return 1;
        const i = Math.floor(n);
        if (i < MIN_SIZE) return MIN_SIZE;
        if (i > MAX_SIZE) return MAX_SIZE;
        return i;
    }

    function maxValueFor(size: number): number {
        // 2^(size*8) - 1, safe for size <= 4
        return Math.pow(256, size) - 1;
    }

    function sizeLabel(size: number): string {
        return size * 8 + "-bit";
    }

    function strToAddress(s: string): number | undefined {
        const v = parseInt(s, 16);
        if (isNaN(v) || v < 0 || v > 0xffff) return undefined;
        return v;
    }

    function parseValue(s: string, size: number): number | undefined {
        const trimmed = s.trim();
        if (trimmed.length === 0) return undefined;
        const isHex = /^0x/i.test(trimmed) || /^\$/.test(trimmed);
        const stripped = trimmed.replace(/^0x/i, "").replace(/^\$/, "");
        const v = parseInt(stripped, isHex ? 16 : 10);
        if (isNaN(v) || v < 0) return undefined;
        if (v > maxValueFor(size)) return undefined;
        return v;
    }

    function pokeMemory(addr: number, size: number, value: number) {
        // little-endian
        let v = value;
        for (let i = 0; i < size; i++) {
            writeMemory(addr + i, v & 0xff);
            v = Math.floor(v / 256);
        }
    }

    function onAdd() {
        const addr = strToAddress(addressInput);
        const name = nameInput.trim();
        const size = clampSize(sizeInput);
        if (addr === undefined || name.length === 0) return;
        $Cheats = [
            ...$Cheats,
            { name, address: addr, size } as CheatWatch,
        ];
        nameInput = "";
        addressInput = "";
        sizeInput = 1;
    }

    function onRemove(index: number) {
        if (editingIndex === index) editingIndex = null;
        $Cheats = $Cheats.filter((_, i) => i !== index);
    }

    function startEdit(index: number, currentValue: number | null) {
        if (!$DebuggerAttached) return;
        editingIndex = index;
        editingDraft =
            currentValue === null
                ? ""
                : "0x" +
                  currentValue
                      .toString(16)
                      .padStart($Cheats[index].size * 2, "0");
    }

    function cancelEdit() {
        editingIndex = null;
        editingDraft = "";
    }

    function commitEdit(index: number) {
        const w = $Cheats[index];
        const v = parseValue(editingDraft, w.size);
        if (v === undefined) return;
        pokeMemory(w.address, w.size, v);
        if (w.freeze) {
            const next = [...$Cheats];
            next[index] = { ...w, freezeValue: v };
            $Cheats = next;
        }
        editingIndex = null;
        editingDraft = "";
    }

    function toggleFreeze(index: number, current: number | null) {
        const w = $Cheats[index];
        const next = [...$Cheats];
        const enabling = !w.freeze;
        next[index] = {
            ...w,
            freeze: enabling,
            freezeValue: enabling
                ? (w.freezeValue ?? current ?? 0)
                : w.freezeValue,
        };
        $Cheats = next;
    }

    type CheatsBundle = {
        type: "svelteboy-cheats";
        version: 1;
        cheats: CheatWatch[];
        valueMaps: ValueMap[];
    };

    let importStatus: string = $state("");
    let fileInput: HTMLInputElement | undefined = $state();

    function exportBundle() {
        const bundle: CheatsBundle = {
            type: "svelteboy-cheats",
            version: 1,
            cheats: $Cheats,
            valueMaps: $ValueMaps,
        };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const ts = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .replace("T", "_")
            .slice(0, 19);
        const a = document.createElement("a");
        a.href = url;
        a.download = `svelteboy-cheats-${ts}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function isCheatWatch(x: unknown): x is CheatWatch {
        if (!x || typeof x !== "object") return false;
        const w = x as Record<string, unknown>;
        return (
            typeof w.name === "string" &&
            typeof w.address === "number" &&
            typeof w.size === "number"
        );
    }

    function isValueMap(x: unknown): x is ValueMap {
        if (!x || typeof x !== "object") return false;
        const m = x as Record<string, unknown>;
        return (
            typeof m.name === "string" &&
            !!m.entries &&
            typeof m.entries === "object"
        );
    }

    async function onImportFile(ev: Event) {
        const input = ev.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (parsed?.type !== "svelteboy-cheats")
                throw new Error("not a svelteboy-cheats bundle");
            if (parsed?.version !== 1)
                throw new Error("unsupported version " + parsed.version);
            const importedCheats: CheatWatch[] = Array.isArray(parsed.cheats)
                ? parsed.cheats.filter(isCheatWatch)
                : [];
            const importedMaps: ValueMap[] = Array.isArray(parsed.valueMaps)
                ? parsed.valueMaps.filter(isValueMap)
                : [];

            // merge maps by name (imported wins)
            const mapByName = new Map<string, ValueMap>();
            for (const m of $ValueMaps) mapByName.set(m.name, m);
            for (const m of importedMaps) mapByName.set(m.name, m);
            $ValueMaps = Array.from(mapByName.values());

            // append cheats (dedupe exact triples name+addr+size)
            const key = (w: CheatWatch) =>
                w.name + "@" + w.address + ":" + w.size;
            const existing = new Set($Cheats.map(key));
            const additions = importedCheats.filter(
                (w) => !existing.has(key(w)),
            );
            $Cheats = [...$Cheats, ...additions];

            importStatus =
                `Imported ${additions.length} cheat${additions.length === 1 ? "" : "s"}` +
                ` (${importedCheats.length - additions.length} duplicates skipped),` +
                ` ${importedMaps.length} map${importedMaps.length === 1 ? "" : "s"}.`;
        } catch (err) {
            importStatus =
                "Import failed: " +
                (err instanceof Error ? err.message : String(err));
        } finally {
            input.value = "";
        }
    }

    function findMap(name: string | undefined): ValueMap | undefined {
        if (!name) return undefined;
        return $ValueMaps.find((m) => m.name === name);
    }

    function lookupName(map: ValueMap | undefined, value: number): string | undefined {
        if (!map) return undefined;
        return map.entries[value.toString()];
    }

    function setWatchMap(index: number, mapName: string) {
        const next = [...$Cheats];
        next[index] = {
            ...next[index],
            valueMapName: mapName.length === 0 ? undefined : mapName,
        };
        $Cheats = next;
    }

    function readWatch(w: CheatWatch): { hex: string; dec: number } | null {
        if (!$DebuggerAttached || $GbDebugInfoStore === undefined) return null;
        const bytes = hexDump(w.address, w.size);
        let value = 0;
        for (let i = w.size - 1; i >= 0; i--) value = value * 256 + bytes[i];
        const hex = "0x" + value.toString(16).padStart(w.size * 2, "0");
        return { hex, dec: value };
    }

    // recompute on debug info tick; also re-apply freezes
    let watchValues = $derived.by(() => {
        $GbDebugInfoStore;
        const values = $Cheats.map(readWatch);
        if ($DebuggerAttached) {
            for (let i = 0; i < $Cheats.length; i++) {
                const w = $Cheats[i];
                if (w.freeze && w.freezeValue !== undefined) {
                    pokeMemory(w.address, w.size, w.freezeValue);
                }
            }
        }
        return values;
    });
</script>

<div class="cheats-section">
    <div class="cheats-header">
        <h4 class="title">Cheats / Watches:</h4>
        <div class="io-buttons">
            <button type="button" onclick={exportBundle}>Export</button>
            <button
                type="button"
                onclick={() => fileInput?.click()}>Import</button
            >
            <input
                bind:this={fileInput}
                type="file"
                accept="application/json,.json"
                onchange={onImportFile}
                style="display:none"
            />
        </div>
    </div>
    {#if importStatus}
        <p class="import-status">{importStatus}</p>
    {/if}
    <div class="cheats-info">
        <form
            class="add-cheat-form"
            onsubmit={(e) => {
                e.preventDefault();
                onAdd();
            }}
        >
            <input
                class="name-input"
                type="text"
                bind:value={nameInput}
                placeholder="name"
            />
            <input
                class="address-input"
                type="text"
                bind:value={addressInput}
                placeholder="addr (hex)"
            />
            <label class="size-input-label" title="Size in bytes (1-4)">
                <input
                    class="size-input"
                    type="number"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    bind:value={sizeInput}
                />
                bytes
            </label>
            <button
                type="submit"
                disabled={strToAddress(addressInput) === undefined ||
                    nameInput.trim().length === 0}
            >
                Add
            </button>
        </form>

        {#if $Cheats.length === 0}
            <p class="empty-hint">No watches.</p>
        {:else}
            <table class="cheats-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Addr</th>
                        <th>Size</th>
                        <th>Map</th>
                        <th>Value</th>
                        <th title="Freeze">🔒</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each $Cheats as w, i (w.name + "@" + w.address + ":" + w.size)}
                        {@const v = watchValues[i]}
                        {@const map = findMap(w.valueMapName)}
                        {@const mappedName = v ? lookupName(map, v.dec) : undefined}
                        {@const datalistId = `cheat-map-${i}`}
                        <tr class:frozen={w.freeze}>
                            <td>{w.name}</td>
                            <td class="addr">{uToHex16(w.address)}</td>
                            <td>{sizeLabel(w.size)}</td>
                            <td>
                                <select
                                    value={w.valueMapName ?? ""}
                                    onchange={(e) =>
                                        setWatchMap(
                                            i,
                                            (e.currentTarget as HTMLSelectElement)
                                                .value,
                                        )}
                                >
                                    <option value="">—</option>
                                    {#each $ValueMaps as m}
                                        <option value={m.name}>{m.name}</option>
                                    {/each}
                                </select>
                            </td>
                            <td class="value">
                                {#if editingIndex === i}
                                    <form
                                        onsubmit={(e) => {
                                            e.preventDefault();
                                            commitEdit(i);
                                        }}
                                    >
                                        {#if map}
                                            <datalist id={datalistId}>
                                                {#each Object.entries(map.entries) as [k, label] (k)}
                                                    <option
                                                        value={"0x" +
                                                            parseInt(k)
                                                                .toString(16)
                                                                .padStart(
                                                                    w.size * 2,
                                                                    "0",
                                                                )}>{label}</option
                                                    >
                                                {/each}
                                            </datalist>
                                        {/if}
                                        <!-- svelte-ignore a11y_autofocus -->
                                        <input
                                            class="value-input"
                                            type="text"
                                            list={map ? datalistId : undefined}
                                            bind:value={editingDraft}
                                            onkeydown={(e) => {
                                                if (e.key === "Escape")
                                                    cancelEdit();
                                            }}
                                            onblur={() => commitEdit(i)}
                                            autofocus
                                        />
                                    </form>
                                {:else if v}
                                    <button
                                        type="button"
                                        class="value-cell"
                                        onclick={() => startEdit(i, v.dec)}
                                        title={"Click to edit (raw " +
                                            v.hex +
                                            ")"}
                                    >
                                        {#if mappedName}
                                            <span class="mapped-name"
                                                >{mappedName}</span
                                            >
                                            <span class="dec"
                                                >[{v.hex}]</span
                                            >
                                        {:else}
                                            <span class="hex">{v.hex}</span>
                                            <span class="dec">({v.dec})</span>
                                        {/if}
                                    </button>
                                {:else}
                                    <span class="detached">—</span>
                                {/if}
                            </td>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={w.freeze ?? false}
                                    disabled={!$DebuggerAttached}
                                    onchange={() =>
                                        toggleFreeze(i, v?.dec ?? null)}
                                    title={w.freeze && w.freezeValue !== undefined
                                        ? "Frozen at 0x" +
                                          w.freezeValue
                                              .toString(16)
                                              .padStart(w.size * 2, "0")
                                        : "Freeze value"}
                                />
                            </td>
                            <td>
                                <button
                                    class="remove-button"
                                    onclick={() => onRemove(i)}>X</button
                                >
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
        {#if !$DebuggerAttached}
            <p class="detached-hint">
                Attach debugger to read/edit live values.
            </p>
        {/if}
    </div>
</div>

<style>
    .cheats-section {
        display: flex;
        flex-direction: column;
        text-align: center;
        align-items: center;
        gap: 0.6em;
        margin-top: 0.5em;
    }
    .title {
        font-size: 1.1em;
        font-weight: 500;
    }
    .cheats-header {
        display: flex;
        align-items: center;
        gap: 1em;
        justify-content: center;
    }
    .io-buttons {
        display: flex;
        gap: 0.3em;
    }
    .import-status {
        color: #aaa;
        font-size: 0.85em;
        margin: 0;
        text-align: center;
    }
    .cheats-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5em;
    }
    .add-cheat-form {
        display: flex;
        gap: 0.4em;
        align-items: center;
    }
    .name-input {
        width: 8em;
    }
    .address-input {
        width: 6em;
    }
    .size-input-label {
        display: inline-flex;
        align-items: center;
        gap: 0.2em;
        color: #aaa;
        font-size: 0.9em;
    }
    .size-input {
        width: 3em;
    }
    .cheats-table {
        border-collapse: collapse;
        font-size: 0.9em;
    }
    .cheats-table th,
    .cheats-table td {
        padding: 0.2em 0.6em;
        border-bottom: 1px solid var(--text-faded-color, #444);
    }
    .cheats-table th {
        color: #999;
        font-weight: 500;
    }
    .addr {
        font-family: monospace;
        color: #aaa;
    }
    .value-cell {
        background: none;
        border: 1px solid transparent;
        color: inherit;
        cursor: pointer;
        padding: 0.1em 0.4em;
        border-radius: 3px;
    }
    .value-cell:hover {
        border-color: #666;
        background-color: rgba(255, 255, 255, 0.05);
    }
    .value-input {
        width: 6em;
        font-family: monospace;
    }
    .value .hex {
        font-family: monospace;
    }
    .value .dec {
        color: #999;
        font-size: 0.85em;
        margin-left: 0.3em;
    }
    .frozen .value-cell .hex {
        color: #6cf;
    }
    .mapped-name {
        font-weight: 500;
    }
    .frozen .mapped-name {
        color: #6cf;
    }
    .detached,
    .detached-hint {
        color: #888;
        font-style: italic;
    }
    .empty-hint {
        color: #888;
        margin: 0;
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
