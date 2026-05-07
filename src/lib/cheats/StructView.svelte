<script lang="ts">
    import type { FieldType, StructSchema, ValueMap } from "./types";
    import StructLeaf from "./StructLeaf.svelte";
    import StructView from "./StructView.svelte";
    import { fieldTypeSize, schemaSize, type SchemaMap } from "./schema";

    type Props = {
        schema: StructSchema;
        bytes: Uint8Array;
        baseAddr: number;
        offset?: number;
        schemas: SchemaMap;
        valueMaps: ValueMap[];
        editable: boolean;
        depth?: number;
    };

    let {
        schema,
        bytes,
        baseAddr,
        offset = 0,
        schemas,
        valueMaps,
        editable,
        depth = 0,
    }: Props = $props();

    let collapsed: boolean = $state(false);
    $effect.pre(() => {
        if (depth >= 2) collapsed = true;
    });

    let arrayCollapsed: Record<string, boolean> = $state({});

    function arrayKey(f: { name: string; offset: number }): string {
        return f.name + ":" + f.offset;
    }

    function toggleArray(key: string) {
        arrayCollapsed[key] = !arrayCollapsed[key];
    }

    function fieldLabel(name: string, type: FieldType): string {
        if (type.kind === "array") return `${name}[${type.count}]`;
        return name;
    }
</script>

<div class="struct" class:nested={depth > 0}>
    <button
        type="button"
        class="toggle"
        onclick={() => (collapsed = !collapsed)}
    >
        {collapsed ? "▶" : "▼"} {schema.id}
        <span class="size">({schemaSize(schema, schemas)} B)</span>
    </button>
    {#if !collapsed}
        <table class="struct-table">
            <tbody>
                {#each schema.fields as f (f.name + ":" + f.offset)}
                    <tr>
                        <th>{fieldLabel(f.name, f.type)}</th>
                        <td class="addr">@{(baseAddr + offset + f.offset).toString(16).padStart(4, "0")}</td>
                        <td class="value">
                            {#if f.type.kind === "ref"}
                                {@const child = schemas.get(f.type.schemaId)}
                                {#if child}
                                    <StructView
                                        schema={child}
                                        {bytes}
                                        {baseAddr}
                                        offset={offset + f.offset}
                                        {schemas}
                                        {valueMaps}
                                        {editable}
                                        depth={depth + 1}
                                    />
                                {:else}
                                    <span class="missing">[missing schema "{f.type.schemaId}"]</span>
                                {/if}
                            {:else if f.type.kind === "array"}
                                {@const itemSize = fieldTypeSize(f.type.of, schemas)}
                                {@const aKey = arrayKey(f)}
                                {@const aCollapsed = arrayCollapsed[aKey] ?? false}
                                <button
                                    type="button"
                                    class="toggle"
                                    onclick={() => toggleArray(aKey)}
                                >
                                    {aCollapsed ? "▶" : "▼"}
                                    <span class="size">{f.type.count} items</span>
                                </button>
                                {#if !aCollapsed}
                                    <div class="array">
                                        {#each Array(f.type.count) as _, idx (idx)}
                                            <div class="array-item">
                                                <span class="idx">[{idx}]</span>
                                                {#if f.type.of.kind === "ref"}
                                                    {@const child = schemas.get(f.type.of.schemaId)}
                                                    {#if child}
                                                        <StructView
                                                            schema={child}
                                                            {bytes}
                                                            {baseAddr}
                                                            offset={offset + f.offset + idx * itemSize}
                                                            {schemas}
                                                            {valueMaps}
                                                            {editable}
                                                            depth={depth + 1}
                                                        />
                                                    {:else}
                                                        <span class="missing">[missing]</span>
                                                    {/if}
                                                {:else}
                                                    <StructLeaf
                                                        type={f.type.of}
                                                        {bytes}
                                                        {baseAddr}
                                                        offset={offset + f.offset + idx * itemSize}
                                                        {schemas}
                                                        {valueMaps}
                                                        {editable}
                                                    />
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            {:else}
                                <StructLeaf
                                    type={f.type}
                                    {bytes}
                                    {baseAddr}
                                    offset={offset + f.offset}
                                    {schemas}
                                    {valueMaps}
                                    {editable}
                                />
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .struct {
        font-size: 0.9em;
    }
    .struct.nested {
        border-left: 2px solid #444;
        padding-left: 0.4em;
    }
    .toggle {
        background: none;
        border: none;
        color: #aaa;
        cursor: pointer;
        font-family: monospace;
        font-size: 0.85em;
        padding: 0.1em 0;
    }
    .toggle:hover {
        color: #fff;
    }
    .size {
        color: #777;
        font-size: 0.9em;
    }
    .struct-table {
        border-collapse: collapse;
    }
    .struct-table th {
        text-align: left;
        font-weight: 500;
        padding: 0.1em 0.5em 0.1em 0;
        color: #ccc;
        vertical-align: top;
    }
    .struct-table td {
        padding: 0.1em 0.3em;
        vertical-align: top;
    }
    .addr {
        font-family: monospace;
        color: #777;
        font-size: 0.85em;
    }
    .array {
        display: flex;
        flex-direction: column;
        gap: 0.1em;
        max-height: 20em;
        overflow-y: auto;
    }
    .array-item {
        display: flex;
        align-items: center;
        gap: 0.2em;
    }
    .idx {
        color: #777;
        font-family: monospace;
        font-size: 1.5em;
        min-width: 2.5em;
    }
    .missing {
        color: #c66;
        font-style: italic;
    }
</style>
