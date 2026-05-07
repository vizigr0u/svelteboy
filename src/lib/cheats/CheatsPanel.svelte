<script lang="ts">
    import { hexDump, writeMemory } from "../../../build/backend";
    import { CheatCollections, Cheats } from "./stores";
    import { EmulatorInitialized, GameFrames } from "stores/playStores";
    import type { CheatCollection, CheatWatch, FieldType, ValueMap } from "./types";
    import { uToHex16 } from "../../utils";
    import StructView from "./StructView.svelte";
    import StructLeaf from "./StructLeaf.svelte";
    import { fieldTypeSize, schemaSize, validateSchemas } from "./schema";
    import {
        bundleFromWatches,
        cloneCollection,
        isCheatCollection,
        mergeSchemas,
        mergeValueMaps,
    } from "./collections";
    import { PRESETS } from "./presets";

    const MIN_SIZE = 1;
    const MAX_SIZE = 4;

    let nameInput: string = $state("");
    let addressInput: string = $state("");
    let sizeInput: number = $state(1);
    // "" raw uint of size; "type:<kind>"; "map:<name>"; "schema:<id>"
    let typeInput: string = $state("");

    const PRIMITIVE_TYPES: { value: string; label: string; fixedSize?: number; needsLength?: boolean }[] = [
        { value: "type:u8", label: "u8", fixedSize: 1 },
        { value: "type:u16le", label: "u16 LE", fixedSize: 2 },
        { value: "type:u16be", label: "u16 BE", fixedSize: 2 },
        { value: "type:u32le", label: "u32 LE", fixedSize: 4 },
        { value: "type:ascii", label: "ascii (len)", needsLength: true },
        { value: "type:bcd-le", label: "bcd LE (len)", needsLength: true },
        { value: "type:bcd-be", label: "bcd BE (len)", needsLength: true },
    ];

    function onTypeChange() {
        const p = PRIMITIVE_TYPES.find((t) => t.value === typeInput);
        if (p?.fixedSize !== undefined) sizeInput = p.fixedSize;
    }

    let typeFixedSize = $derived(PRIMITIVE_TYPES.find((t) => t.value === typeInput)?.fixedSize);
    let sizeInputDisabled = $derived(typeInput.startsWith("schema:") || typeFixedSize !== undefined);

    function buildFieldType(kind: string, length: number): FieldType | undefined {
        switch (kind) {
            case "u8": return { kind: "u8" };
            case "u16le": return { kind: "u16le" };
            case "u16be": return { kind: "u16be" };
            case "u32le": return { kind: "u32le" };
            case "ascii": return { kind: "ascii", length };
            case "bcd-le": return { kind: "bcd", length, bigEndian: false };
            case "bcd-be": return { kind: "bcd", length, bigEndian: true };
        }
        return undefined;
    }

    let editingIndex: number | null = $state(null);
    let editingDraft: string = $state("");

    let mergedSchemaMap = $derived(mergeSchemas($CheatCollections));
    let mergedValueMapMap = $derived(mergeValueMaps($CheatCollections));
    let mergedValueMaps = $derived(Array.from(mergedValueMapMap.values()));
    let mergedSchemas = $derived(Array.from(mergedSchemaMap.values()));

    function clampSize(n: number): number {
        if (!Number.isFinite(n)) return 1;
        const i = Math.floor(n);
        if (i < MIN_SIZE) return MIN_SIZE;
        if (i > MAX_SIZE) return MAX_SIZE;
        return i;
    }

    function maxValueFor(size: number): number {
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
        const watch: CheatWatch = { name, address: addr, size };
        if (typeInput.startsWith("schema:")) {
            watch.schemaId = typeInput.slice("schema:".length);
        } else if (typeInput.startsWith("map:")) {
            watch.valueMapName = typeInput.slice("map:".length);
        } else if (typeInput.startsWith("type:")) {
            const ft = buildFieldType(typeInput.slice("type:".length), size);
            if (ft) watch.fieldType = ft;
        }
        $Cheats = [...$Cheats, watch];
        nameInput = "";
        addressInput = "";
        sizeInput = 1;
        typeInput = "";
    }

    function onRemove(index: number) {
        if (editingIndex === index) editingIndex = null;
        $Cheats = $Cheats.filter((_, i) => i !== index);
    }

    function startEdit(index: number, currentValue: number | null) {
        editingIndex = index;
        editingDraft =
            currentValue === null
                ? ""
                : "0x" +
                  currentValue.toString(16).padStart($Cheats[index].size * 2, "0");
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

    function effectiveSize(w: CheatWatch): number {
        if (w.schemaId) {
            const s = mergedSchemaMap.get(w.schemaId);
            if (s) return schemaSize(s, mergedSchemaMap);
        }
        if (w.fieldType) return fieldTypeSize(w.fieldType, mergedSchemaMap);
        return w.size;
    }

    function setWatchSchema(index: number, schemaId: string) {
        const next = [...$Cheats];
        next[index] = {
            ...next[index],
            schemaId: schemaId.length === 0 ? undefined : schemaId,
            fieldType: schemaId.length === 0 ? next[index].fieldType : undefined,
        };
        $Cheats = next;
    }

    function setWatchMap(index: number, mapName: string) {
        const next = [...$Cheats];
        next[index] = {
            ...next[index],
            valueMapName: mapName.length === 0 ? undefined : mapName,
            fieldType: mapName.length === 0 ? next[index].fieldType : undefined,
        };
        $Cheats = next;
    }

    function findMap(name: string | undefined): ValueMap | undefined {
        if (!name) return undefined;
        return mergedValueMapMap.get(name);
    }

    function lookupName(map: ValueMap | undefined, value: number): string | undefined {
        if (!map) return undefined;
        return map.entries[value.toString()];
    }

    // --- Collections / Presets ---

    let panelOpen: boolean = $state(false);
    let saveName: string = $state("");
    let saveId: string = $state("");
    let saveDescription: string = $state("");
    let importStatus: string = $state("");
    let fileInput: HTMLInputElement | undefined = $state();

    function isPresetLoaded(presetId: string): boolean {
        return $CheatCollections.some((c) => c.id === presetId);
    }

    function loadPreset(p: CheatCollection) {
        if (isPresetLoaded(p.id)) return;
        const copy = cloneCollection(p);
        $CheatCollections = [...$CheatCollections, copy];
        // append watches not already in active list (by name+addr+schemaId triple)
        const key = (w: CheatWatch) => `${w.name}@${w.address}:${w.schemaId ?? ""}`;
        const existing = new Set($Cheats.map(key));
        const adds = copy.watches.filter((w) => !existing.has(key(w)));
        $Cheats = [...$Cheats, ...adds];
        importStatus = `Loaded preset "${p.name}" (+${adds.length} watch${adds.length === 1 ? "" : "es"}).`;
    }

    function removeCollection(index: number) {
        const c = $CheatCollections[index];
        if (!confirm(`Remove collection "${c.name}"? Watches stay in active list.`))
            return;
        $CheatCollections = $CheatCollections.filter((_, i) => i !== index);
    }

    function addCollectionWatches(index: number) {
        const c = $CheatCollections[index];
        const key = (w: CheatWatch) => `${w.name}@${w.address}:${w.schemaId ?? ""}`;
        const existing = new Set($Cheats.map(key));
        const adds = c.watches.filter((w) => !existing.has(key(w)));
        $Cheats = [...$Cheats, ...adds];
        importStatus = `Added ${adds.length} watch${adds.length === 1 ? "" : "es"} from "${c.name}".`;
    }

    function rebundleCollection(index: number) {
        const c = $CheatCollections[index];
        if (!confirm(`Replace contents of "${c.name}" with current cheats (transitive close)?`))
            return;
        const bundled = bundleFromWatches($Cheats, mergedSchemaMap, mergedValueMapMap, {
            id: c.id,
            name: c.name,
            description: c.description,
        });
        const next = [...$CheatCollections];
        next[index] = bundled;
        $CheatCollections = next;
        importStatus = `Updated "${c.name}".`;
    }

    function exportCollection(c: CheatCollection) {
        const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cheats-${c.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function slugify(s: string): string {
        return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }

    function saveCurrentAsCollection() {
        const name = saveName.trim();
        if (name.length === 0) return;
        const id = saveId.trim().length > 0 ? saveId.trim() : slugify(name);
        if (id.length === 0) return;
        if ($CheatCollections.some((c) => c.id === id)) {
            importStatus = `Collection id "${id}" already exists.`;
            return;
        }
        const bundled = bundleFromWatches($Cheats, mergedSchemaMap, mergedValueMapMap, {
            id,
            name,
            description: saveDescription.trim() || undefined,
        });
        $CheatCollections = [...$CheatCollections, bundled];
        importStatus = `Saved "${name}" with ${bundled.watches.length} watch${bundled.watches.length === 1 ? "" : "es"}, ${bundled.schemas.length} schema${bundled.schemas.length === 1 ? "" : "s"}, ${bundled.valueMaps.length} map${bundled.valueMaps.length === 1 ? "" : "s"}.`;
        saveName = "";
        saveId = "";
        saveDescription = "";
    }

    async function onImportFile(ev: Event) {
        const input = ev.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const candidates: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
            const valid: CheatCollection[] = [];
            for (const c of candidates) {
                if (!isCheatCollection(c)) {
                    throw new Error("not a CheatCollection JSON");
                }
                const v = validateSchemas(c.schemas);
                if (!v.valid) {
                    throw new Error(`schema invalid in "${c.id}": ${v.errors.join("; ")}`);
                }
                valid.push(c);
            }
            const byId = new Map<string, CheatCollection>();
            for (const c of $CheatCollections) byId.set(c.id, c);
            for (const c of valid) byId.set(c.id, cloneCollection(c));
            $CheatCollections = Array.from(byId.values());
            importStatus = `Imported ${valid.length} collection${valid.length === 1 ? "" : "s"}.`;
        } catch (err) {
            importStatus =
                "Import failed: " + (err instanceof Error ? err.message : String(err));
        } finally {
            input.value = "";
        }
    }

    function readWatch(
        w: CheatWatch,
    ): { hex: string; dec: number; bytes: Uint8Array } | null {
        if (!$EmulatorInitialized) return null;
        const size = effectiveSize(w);
        if (size === 0) return null;
        const bytes = hexDump(w.address, size);
        let value = 0;
        const primSize = Math.min(size, 4);
        for (let i = primSize - 1; i >= 0; i--) value = value * 256 + bytes[i];
        const hex = "0x" + value.toString(16).padStart(primSize * 2, "0");
        return { hex, dec: value, bytes };
    }

    let watchValues = $derived.by(() => {
        $GameFrames;
        const values = $Cheats.map(readWatch);
        if ($EmulatorInitialized) {
            for (let i = 0; i < $Cheats.length; i++) {
                const w = $Cheats[i];
                if (w.schemaId) continue;
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
            <button type="button" onclick={() => (panelOpen = !panelOpen)}>
                Collections ▾
            </button>
            <button type="button" onclick={() => fileInput?.click()}>Import</button>
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

    {#if panelOpen}
        <div class="collections-panel">
            <div class="panel-block">
                <h5>Presets</h5>
                {#if PRESETS.length === 0}
                    <p class="empty-hint">No presets.</p>
                {:else}
                    <ul class="preset-list">
                        {#each PRESETS as p (p.id)}
                            <li>
                                <span class="coll-name">{p.name}</span>
                                <span class="coll-meta">
                                    {p.watches.length}w / {p.schemas.length}s / {p.valueMaps.length}m
                                </span>
                                <button
                                    type="button"
                                    disabled={isPresetLoaded(p.id)}
                                    onclick={() => loadPreset(p)}
                                >
                                    {isPresetLoaded(p.id) ? "Loaded" : "Load"}
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>

            <div class="panel-block">
                <h5>My Collections</h5>
                {#if $CheatCollections.length === 0}
                    <p class="empty-hint">No saved collections.</p>
                {:else}
                    <ul class="coll-list">
                        {#each $CheatCollections as c, ci (c.id)}
                            <li>
                                <span class="coll-name" title={c.description ?? ""}>
                                    {c.name}
                                </span>
                                <span class="coll-meta">
                                    {c.watches.length}w / {c.schemas.length}s / {c.valueMaps.length}m
                                </span>
                                <button type="button" onclick={() => addCollectionWatches(ci)}>
                                    + Watches
                                </button>
                                <button type="button" onclick={() => rebundleCollection(ci)}>
                                    Update
                                </button>
                                <button type="button" onclick={() => exportCollection(c)}>
                                    Export
                                </button>
                                <button
                                    class="remove-button"
                                    type="button"
                                    onclick={() => removeCollection(ci)}
                                    title="Remove collection">X</button
                                >
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>

            <div class="panel-block">
                <h5>Save current as collection</h5>
                <form
                    class="save-form"
                    onsubmit={(e) => {
                        e.preventDefault();
                        saveCurrentAsCollection();
                    }}
                >
                    <input type="text" bind:value={saveName} placeholder="name" />
                    <input
                        type="text"
                        bind:value={saveId}
                        placeholder={"id (auto: " + slugify(saveName || "") + ")"}
                    />
                    <input
                        type="text"
                        bind:value={saveDescription}
                        placeholder="description (optional)"
                    />
                    <button
                        type="submit"
                        disabled={saveName.trim().length === 0 || $Cheats.length === 0}
                    >
                        Save
                    </button>
                </form>
            </div>
        </div>
    {/if}

    <div class="cheats-info">
        <form
            class="add-cheat-form"
            onsubmit={(e) => {
                e.preventDefault();
                onAdd();
            }}
        >
            <input class="name-input" type="text" bind:value={nameInput} placeholder="name" />
            <input
                class="address-input"
                type="text"
                bind:value={addressInput}
                placeholder="addr (hex)"
            />
            <label class="size-input-label" title="Size / length (ignored for fixed-size types and schemas)">
                <input
                    class="size-input"
                    type="number"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    bind:value={sizeInput}
                    disabled={sizeInputDisabled}
                />
                bytes
            </label>
            <select
                bind:value={typeInput}
                onchange={onTypeChange}
                title="Optional primitive type / value-map / struct schema"
            >
                <option value="">— raw uint —</option>
                <optgroup label="Primitive Types">
                    {#each PRIMITIVE_TYPES as t}
                        <option value={t.value}>{t.label}</option>
                    {/each}
                </optgroup>
                {#if mergedValueMaps.length > 0}
                    <optgroup label="Value Maps">
                        {#each mergedValueMaps as m}
                            <option value={"map:" + m.name}>{m.name}</option>
                        {/each}
                    </optgroup>
                {/if}
                {#if mergedSchemas.length > 0}
                    <optgroup label="Struct Schemas">
                        {#each mergedSchemas as s}
                            <option value={"schema:" + s.id}>{s.id}</option>
                        {/each}
                    </optgroup>
                {/if}
            </select>
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
                        <th>Map / Schema</th>
                        <th>Value</th>
                        <th title="Freeze">🔒</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each $Cheats as w, i (w.name + "@" + w.address + ":" + w.size + ":" + (w.schemaId ?? ""))}
                        {@const v = watchValues[i]}
                        {@const map = findMap(w.valueMapName)}
                        {@const mappedName = v && !w.schemaId ? lookupName(map, v.dec) : undefined}
                        {@const datalistId = `cheat-map-${i}`}
                        {@const schema = w.schemaId ? mergedSchemaMap.get(w.schemaId) : undefined}
                        <tr class:frozen={w.freeze}>
                            <td>{w.name}</td>
                            <td class="addr">{uToHex16(w.address)}</td>
                            <td>
                                {#if w.schemaId}
                                    <span class="schema-size" title="Computed from schema">{effectiveSize(w)} B</span>
                                {:else if w.fieldType}
                                    <span class="schema-size" title="Computed from field type">{effectiveSize(w)} B</span>
                                {:else}
                                    {sizeLabel(w.size)}
                                {/if}
                            </td>
                            <td>
                                <select
                                    value={w.schemaId
                                        ? "schema:" + w.schemaId
                                        : (w.valueMapName ?? "")}
                                    onchange={(e) => {
                                        const v = (e.currentTarget as HTMLSelectElement).value;
                                        if (v.startsWith("schema:")) {
                                            setWatchSchema(i, v.slice("schema:".length));
                                            setWatchMap(i, "");
                                        } else {
                                            setWatchSchema(i, "");
                                            setWatchMap(i, v);
                                        }
                                    }}
                                >
                                    <option value="">—</option>
                                    {#if mergedValueMaps.length > 0}
                                        <optgroup label="Value Maps">
                                            {#each mergedValueMaps as m}
                                                <option value={m.name}>{m.name}</option>
                                            {/each}
                                        </optgroup>
                                    {/if}
                                    {#if mergedSchemas.length > 0}
                                        <optgroup label="Struct Schemas">
                                            {#each mergedSchemas as s}
                                                <option value={"schema:" + s.id}>{s.id}</option>
                                            {/each}
                                        </optgroup>
                                    {/if}
                                </select>
                            </td>
                            <td class="value">
                                {#if w.schemaId && schema}
                                    {#if v}
                                        <StructView
                                            {schema}
                                            bytes={v.bytes}
                                            baseAddr={w.address}
                                            schemas={mergedSchemaMap}
                                            valueMaps={mergedValueMaps}
                                            editable={$EmulatorInitialized}
                                        />
                                    {:else}
                                        <span class="detached">—</span>
                                    {/if}
                                {:else if w.schemaId && !schema}
                                    <span class="missing">[missing schema "{w.schemaId}"]</span>
                                {:else if w.fieldType}
                                    {#if v}
                                        <StructLeaf
                                            type={w.fieldType}
                                            bytes={v.bytes}
                                            baseAddr={w.address}
                                            offset={0}
                                            schemas={mergedSchemaMap}
                                            valueMaps={mergedValueMaps}
                                            editable={$EmulatorInitialized}
                                        />
                                    {:else}
                                        <span class="detached">—</span>
                                    {/if}
                                {:else if editingIndex === i}
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
                                                                .padStart(w.size * 2, "0")}>{label}</option
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
                                                if (e.key === "Escape") cancelEdit();
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
                                        title={"Click to edit (raw " + v.hex + ")"}
                                    >
                                        {#if mappedName}
                                            <span class="mapped-name">{mappedName}</span>
                                            <span class="dec">[{v.hex}]</span>
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
                                {#if w.schemaId || w.fieldType}
                                    <span class="detached">—</span>
                                {:else}
                                    <input
                                        type="checkbox"
                                        checked={w.freeze ?? false}
                                        disabled={!$EmulatorInitialized}
                                        onchange={() => toggleFreeze(i, v?.dec ?? null)}
                                        title={w.freeze && w.freezeValue !== undefined
                                            ? "Frozen at 0x" +
                                              w.freezeValue.toString(16).padStart(w.size * 2, "0")
                                            : "Freeze value"}
                                    />
                                {/if}
                            </td>
                            <td>
                                <button class="remove-button" onclick={() => onRemove(i)}>X</button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
        {#if !$EmulatorInitialized}
            <p class="detached-hint">Load a ROM to read/edit live values.</p>
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
    .collections-panel {
        display: flex;
        flex-direction: column;
        gap: 0.7em;
        border: 1px solid #444;
        padding: 0.6em;
        background-color: rgba(255, 255, 255, 0.02);
        align-self: stretch;
    }
    .panel-block h5 {
        margin: 0 0 0.3em 0;
        font-size: 0.95em;
        color: #ccc;
    }
    .preset-list,
    .coll-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25em;
    }
    .preset-list li,
    .coll-list li {
        display: flex;
        align-items: center;
        gap: 0.4em;
    }
    .coll-name {
        flex: 1;
        text-align: left;
    }
    .coll-meta {
        color: #888;
        font-size: 0.8em;
        font-family: monospace;
    }
    .save-form {
        display: flex;
        gap: 0.3em;
        flex-wrap: wrap;
    }
    .save-form input {
        flex: 1;
        min-width: 6em;
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
    .schema-size {
        color: #aaa;
        font-size: 0.85em;
    }
    .missing {
        color: #c66;
        font-style: italic;
        font-size: 0.85em;
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
