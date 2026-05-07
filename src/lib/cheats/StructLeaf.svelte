<script lang="ts">
    import type { FieldType, ValueMap } from "./types";
    import { writeMemory } from "../../../build/backend";
    import {
        readU,
        readBcd,
        readAscii,
        leToBytes,
        beToBytes,
        bcdToBytes,
        fieldTypeSize,
        type SchemaMap,
    } from "./schema";

    type Props = {
        type: FieldType;
        bytes: Uint8Array;
        baseAddr: number;
        offset: number;
        schemas: SchemaMap;
        valueMaps: ValueMap[];
        editable: boolean;
    };

    let { type, bytes, baseAddr, offset, schemas, valueMaps, editable }: Props = $props();

    let editing: boolean = $state(false);
    let draft: string = $state("");
    let inputEl: HTMLInputElement | undefined = $state();
    let suppressBlur: boolean = $state(false);

    let size = $derived(fieldTypeSize(type, schemas));

    function findMap(name: string): ValueMap | undefined {
        return valueMaps.find((m) => m.name === name);
    }

    function pokeBytes(addr: number, data: number[]) {
        for (let i = 0; i < data.length; i++) writeMemory(addr + i, data[i] & 0xff);
    }

    function parseUint(s: string, max: number): number | undefined {
        const t = s.trim();
        if (t.length === 0) return undefined;
        const isHex = /^0x/i.test(t) || /^\$/.test(t);
        const v = parseInt(t.replace(/^0x/i, "").replace(/^\$/, ""), isHex ? 16 : 10);
        if (isNaN(v) || v < 0 || v > max) return undefined;
        return v;
    }

    function startEdit(initial: string) {
        if (!editable) return;
        editing = true;
        draft = initial;
    }

    function cancelEdit() {
        editing = false;
        draft = "";
    }

    function commit() {
        if (!editable) {
            cancelEdit();
            return;
        }
        const addr = baseAddr + offset;
        switch (type.kind) {
            case "u8": {
                const v = parseUint(draft, 0xff);
                if (v !== undefined) pokeBytes(addr, [v]);
                break;
            }
            case "u16le": {
                const v = parseUint(draft, 0xffff);
                if (v !== undefined) pokeBytes(addr, leToBytes(v, 2));
                break;
            }
            case "u16be": {
                const v = parseUint(draft, 0xffff);
                if (v !== undefined) pokeBytes(addr, beToBytes(v, 2));
                break;
            }
            case "u32le": {
                const v = parseUint(draft, 0xffffffff);
                if (v !== undefined) pokeBytes(addr, leToBytes(v, 4));
                break;
            }
            case "enum": {
                const max = type.bytes === 1 ? 0xff : 0xffff;
                const v = parseUint(draft, max);
                if (v !== undefined) pokeBytes(addr, leToBytes(v, type.bytes));
                break;
            }
            case "ascii": {
                const out: number[] = [];
                for (let i = 0; i < type.length; i++) {
                    out.push(i < draft.length ? draft.charCodeAt(i) & 0x7f : 0);
                }
                pokeBytes(addr, out);
                break;
            }
            case "bcd": {
                const v = parseInt(draft.trim(), 10);
                if (!isNaN(v) && v >= 0) pokeBytes(addr, bcdToBytes(v, type.length, !!type.bigEndian));
                break;
            }
            case "bitflags": {
                const max = type.bytes === 1 ? 0xff : 0xffff;
                const v = parseUint(draft, max);
                if (v !== undefined) pokeBytes(addr, leToBytes(v, type.bytes));
                break;
            }
        }
        cancelEdit();
    }

    function toggleBit(bit: number) {
        if (!editable || (type.kind !== "bitflags")) return;
        const cur = readU(bytes, offset, type.bytes, true);
        const next = cur ^ (1 << bit);
        const max = type.bytes === 1 ? 0xff : 0xffff;
        pokeBytes(baseAddr + offset, leToBytes(next & max, type.bytes));
    }

    let display = $derived.by(() => {
        switch (type.kind) {
            case "u8":
            case "u16le":
            case "u16be": {
                const le = type.kind !== "u16be";
                const v = readU(bytes, offset, size, le);
                return { hex: "0x" + v.toString(16).padStart(size * 2, "0"), dec: v.toString() };
            }
            case "u32le": {
                const v = readU(bytes, offset, 4, true);
                return { hex: "0x" + v.toString(16).padStart(8, "0"), dec: v.toString() };
            }
            case "enum": {
                const v = readU(bytes, offset, type.bytes, true);
                const map = findMap(type.mapName);
                const label = map?.entries[v.toString()];
                return { hex: "0x" + v.toString(16).padStart(type.bytes * 2, "0"), dec: v.toString(), label };
            }
            case "ascii":
                return { text: readAscii(bytes, offset, type.length) };
            case "bcd":
                return { text: readBcd(bytes, offset, type.length, !!type.bigEndian).toString() };
            case "bitflags": {
                const v = readU(bytes, offset, type.bytes, true);
                return { hex: "0x" + v.toString(16).padStart(type.bytes * 2, "0"), dec: v.toString(), raw: v };
            }
            default:
                return {};
        }
    });

    function initialDraft(): string {
        switch (type.kind) {
            case "u8":
            case "u16le":
            case "u16be":
            case "u32le":
            case "enum":
            case "bitflags":
                return display.hex ?? "";
            case "ascii":
                return display.text ?? "";
            case "bcd":
                return display.text ?? "";
            default:
                return "";
        }
    }
</script>

{#if type.kind === "bitflags"}
    <span class="bitflags">
        {#each Object.entries(type.bits) as [bitStr, label] (bitStr)}
            {@const bit = parseInt(bitStr, 10)}
            {@const set = ((display.raw ?? 0) >> bit) & 1 ? true : false}
            <button
                type="button"
                class="bit"
                class:set
                disabled={!editable}
                onclick={() => toggleBit(bit)}
                title={`bit ${bit}`}
            >{label}</button>
        {/each}
        <span class="raw">{display.hex}</span>
    </span>
{:else if editing}
    {@const map = type.kind === "enum" ? findMap(type.mapName) : undefined}
    {@const datalistId = `dl-${baseAddr.toString(16)}-${offset}`}
    <form
        class="edit-form"
        onsubmit={(e) => {
            e.preventDefault();
            commit();
        }}
    >
        {#if map}
            <datalist id={datalistId}>
                {#each Object.entries(map.entries) as [k, label] (k)}
                    <option value={"0x" + parseInt(k).toString(16).padStart((type.kind === "enum" ? type.bytes : 1) * 2, "0")}>{label}</option>
                {/each}
            </datalist>
        {/if}
        <!-- svelte-ignore a11y_autofocus -->
        <input
            class="leaf-input"
            type="text"
            list={map ? datalistId : undefined}
            bind:this={inputEl}
            bind:value={draft}
            onkeydown={(e) => { if (e.key === "Escape") cancelEdit(); }}
            onblur={() => { if (!suppressBlur) commit(); suppressBlur = false; }}
            autofocus
        />
        {#if map}
            <button
                type="button"
                class="open-picker"
                title="Show suggestions"
                onmousedown={(e) => { e.preventDefault(); suppressBlur = true; }}
                onclick={() => {
                    inputEl?.focus();
                    const anyEl = inputEl as unknown as { showPicker?: () => void };
                    anyEl?.showPicker?.();
                }}
            >▼</button>
        {/if}
    </form>
{:else}
    <button
        type="button"
        class="leaf-cell"
        disabled={!editable}
        onclick={() => startEdit(initialDraft())}
        title={display.hex ? `raw ${display.hex}` : undefined}
    >
        {#if display.label}
            <span class="mapped">{display.label}</span><span class="dim">[{display.hex}]</span>
        {:else if display.hex !== undefined}
            <span class="mono">{display.hex}</span><span class="dim">({display.dec})</span>
        {:else}
            <span class="mono">{display.text ?? ""}</span>
        {/if}
    </button>
{/if}

<style>
    .leaf-cell {
        background: none;
        border: 1px solid transparent;
        color: inherit;
        cursor: pointer;
        padding: 0.05em 0.3em;
        border-radius: 3px;
        font-size: 0.9em;
    }
    .leaf-cell:hover:not(:disabled) {
        border-color: #666;
        background-color: rgba(255, 255, 255, 0.05);
    }
    .leaf-cell:disabled {
        cursor: default;
    }
    .mono {
        font-family: monospace;
    }
    .dim {
        color: #999;
        font-size: 0.85em;
        margin-left: 0.3em;
    }
    .mapped {
        font-weight: 500;
    }
    .leaf-input {
        width: 8em;
        font-family: monospace;
    }
    .edit-form {
        display: inline-flex;
        gap: 0.1em;
        align-items: center;
    }
    .open-picker {
        background: #333;
        color: #aaa;
        border: 1px solid #555;
        cursor: pointer;
        padding: 0 0.3em;
        font-size: 0.75em;
        border-radius: 2px;
    }
    .open-picker:hover {
        color: #fff;
        border-color: #888;
    }
    .bitflags {
        display: inline-flex;
        gap: 0.2em;
        align-items: center;
        flex-wrap: wrap;
    }
    .bit {
        font-size: 0.75em;
        padding: 0.05em 0.4em;
        border-radius: 2px;
        background-color: #333;
        color: #888;
        border: 1px solid #444;
        cursor: pointer;
    }
    .bit.set {
        background-color: #2a4a6a;
        color: #cef;
        border-color: #4a7aaa;
    }
    .bit:disabled {
        cursor: default;
    }
    .raw {
        font-family: monospace;
        color: #888;
        font-size: 0.8em;
    }
</style>
