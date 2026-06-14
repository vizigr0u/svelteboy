<script lang="ts">
    import { Emulator } from "../emulator";
    import { loadedCartridge } from "stores/romStores";
    import { DebuggerAttached } from "stores/debugStores";
    import { requestConfirm } from "stores/confirmStore";
    import { getAllSlots, deleteSlot, quickSaveVersion, type SaveStateEntry } from "../saveStateDb";
    import { formatRelativeTime } from "../relativeTime";

    let { slotCount = 9, onaction }: { slotCount?: number; onaction?: () => void } = $props();

    let slots: (SaveStateEntry | null)[] = $state([]);
    let cart = $derived($loadedCartridge);
    let menuSlot: number | null = $state(null);

    async function refresh() {
        if (!cart) { slots = []; return; }
        slots = await getAllSlots(cart.sha1, slotCount);
    }

    $effect(() => { cart; slotCount; $quickSaveVersion; refresh(); });

    async function onSlot(slot: number) {
        const entry = slots[slot - 1];
        if (entry) await Emulator.QuickLoad(slot);
        else {
            if (!cart || $DebuggerAttached) return;
            await Emulator.QuickSave(slot);
        }
        onaction?.();
    }

    async function overwrite(slot: number) {
        menuSlot = null;
        if (!cart || $DebuggerAttached) return;
        await Emulator.QuickSave(slot);
    }

    async function remove(slot: number) {
        menuSlot = null;
        if (!cart) return;
        const ok = await requestConfirm({
            title: "Delete quick save",
            message: `Delete quick save slot ${slot}?`,
            confirmLabel: "Delete",
            cancelLabel: "Cancel",
        });
        if (!ok) return;
        await deleteSlot(cart.sha1, slot);
    }

    // Long-press (touch) opens the context menu.
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    function onPointerDown(slot: number, e: PointerEvent) {
        if (e.pointerType !== "touch") return;
        if (!slots[slot - 1]) return;
        pressTimer = setTimeout(() => { menuSlot = slot; pressTimer = null; }, 500);
    }
    function clearPress() {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }
    function onContext(slot: number, e: MouseEvent) {
        if (!slots[slot - 1]) return;
        e.preventDefault();
        menuSlot = slot;
    }
</script>

<div class="strip" role="group" aria-label="Quick save slots">
    {#each Array(slotCount) as _, i (i)}
        {@const slot = i + 1}
        {@const entry = slots[i]}
        <div class="slot-wrap">
            <button
                class="slot"
                class:filled={!!entry}
                disabled={!cart || (!entry && $DebuggerAttached)}
                onclick={() => onSlot(slot)}
                oncontextmenu={(e) => onContext(slot, e)}
                onpointerdown={(e) => onPointerDown(slot, e)}
                onpointerup={clearPress}
                onpointerleave={clearPress}
                title={entry ? `Load slot ${slot}` : `Save to slot ${slot}`}
            >
                {#if entry?.thumbnail}
                    <img src={entry.thumbnail} alt="Slot {slot}" />
                {:else if entry}
                    <span class="ph">{slot}</span>
                {:else}
                    <span class="ph empty">+<small>Save here</small></span>
                {/if}
                <span class="num">{slot}</span>
            </button>
            <span class="ts">{entry ? formatRelativeTime(entry.savedAt) : ""}</span>
            {#if menuSlot === slot}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="ctx" onpointerleave={() => (menuSlot = null)}>
                    <button onclick={() => overwrite(slot)} disabled={$DebuggerAttached}>Overwrite</button>
                    <button class="danger" onclick={() => remove(slot)}>Delete</button>
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .strip {
        display: flex;
        gap: 0.5em;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        padding-bottom: 0.3em;
        -webkit-overflow-scrolling: touch;
    }
    .slot-wrap {
        position: relative;
        flex: 0 0 auto;
        width: 96px;
        scroll-snap-align: start;
        display: flex;
        flex-direction: column;
        gap: 0.2em;
    }
    .slot {
        position: relative;
        background: #111;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.3em;
        padding: 0;
        aspect-ratio: 10 / 9;
        overflow: hidden;
        cursor: pointer;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .slot:hover:not(:disabled) { border-color: var(--highlight-color, #89b4fa); }
    .slot:disabled { opacity: 0.45; cursor: not-allowed; }
    .slot.filled { background: #1a1a2a; }
    .slot img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
    .ph {
        font-size: 1.4em;
        color: rgba(255, 255, 255, 0.35);
        font-family: monospace;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .ph small { font-size: 0.45em; font-family: inherit; letter-spacing: 0.03em; }
    .ph.empty {
        color: rgba(255, 255, 255, 0.3);
    }
    .slot:not(.filled) {
        border-style: dashed;
    }
    .num {
        position: absolute;
        top: 2px;
        left: 4px;
        font-size: 0.7em;
        font-family: monospace;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
        pointer-events: none;
    }
    .ts {
        font-size: 0.7em;
        color: #888;
        text-align: center;
        height: 1em;
        overflow: hidden;
        white-space: nowrap;
    }
    .ctx {
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 5;
        background: #313244;
        border: 1px solid #45475a;
        border-radius: 0.3em;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }
    .ctx button {
        background: none;
        border: none;
        color: #cdd6f4;
        padding: 0.45em 0.9em;
        cursor: pointer;
        font-size: 0.8em;
        text-align: left;
        white-space: nowrap;
    }
    .ctx button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
    .ctx button:disabled { opacity: 0.4; cursor: not-allowed; }
    .ctx button.danger { color: #f38ba8; }
</style>
