<script lang="ts">
    import { onMount, tick } from "svelte";
    import { paletteOpen, closePalette } from "../stores/paletteStore";
    import {
        filterCommands,
        runCommand,
        GROUP_LABELS,
        GROUP_ORDER,
        type Command,
        type CommandGroup,
        type ScoredCommand,
    } from "./commands";

    let query: string = $state("");
    let highlight: number = $state(0);
    let inputEl: HTMLInputElement | undefined = $state();
    let listEl: HTMLDivElement | undefined = $state();

    let scored: ScoredCommand[] = $derived(filterCommands(query));
    let flatItems: Command[] = $derived(scored.map(s => s.cmd));

    type Section = { group: CommandGroup; items: Command[] };
    let sections: Section[] = $derived.by(() => {
        const map = new Map<CommandGroup, Command[]>();
        for (const { cmd } of scored) {
            if (!map.has(cmd.group)) map.set(cmd.group, []);
            map.get(cmd.group)!.push(cmd);
        }
        const out: Section[] = [];
        for (const g of GROUP_ORDER) {
            const items = map.get(g);
            if (items && items.length) out.push({ group: g, items });
        }
        return out;
    });

    function indexOf(cmd: Command): number {
        return flatItems.indexOf(cmd);
    }

    $effect(() => {
        if (highlight >= flatItems.length) highlight = 0;
    });

    async function focusInput() {
        await tick();
        inputEl?.focus();
        inputEl?.select();
    }

    $effect(() => {
        if ($paletteOpen) {
            query = "";
            highlight = 0;
            focusInput();
        }
    });

    function close() { closePalette(); }

    async function runHighlighted() {
        const item = flatItems[highlight];
        if (!item) return;
        close();
        await runCommand(item.id);
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (flatItems.length === 0) return;
            highlight = (highlight + 1) % flatItems.length;
            scrollHighlightIntoView();
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (flatItems.length === 0) return;
            highlight = (highlight - 1 + flatItems.length) % flatItems.length;
            scrollHighlightIntoView();
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            runHighlighted();
            return;
        }
    }

    function scrollHighlightIntoView() {
        const el = listEl?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }

    function onBackdrop(e: MouseEvent) {
        if (e.target === e.currentTarget) close();
    }
</script>

{#if $paletteOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="palette-backdrop" onclick={onBackdrop} role="presentation">
        <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
            <div class="search-row">
                <span class="search-icon" aria-hidden="true">⌕</span>
                <input
                    bind:this={inputEl}
                    bind:value={query}
                    onkeydown={onKeydown}
                    type="text"
                    placeholder="Type a command…"
                    autocomplete="off"
                    spellcheck="false"
                    aria-label="Command search"
                />
                <kbd class="hint-kbd">esc</kbd>
            </div>
            <div class="results" bind:this={listEl}>
                {#if flatItems.length === 0}
                    <div class="empty">No commands match "{query}"</div>
                {:else}
                    {#each sections as section}
                        <div class="group-label">{GROUP_LABELS[section.group]}</div>
                        {#each section.items as cmd}
                            {@const idx = indexOf(cmd)}
                            <!-- svelte-ignore a11y_mouse_events_have_key_events -->
                            <button
                                type="button"
                                class="item"
                                class:highlighted={idx === highlight}
                                data-idx={idx}
                                onmouseenter={() => highlight = idx}
                                onclick={async () => { close(); await runCommand(cmd.id); }}
                            >
                                <span class="item-label">{cmd.label}</span>
                                {#if cmd.shortcut}
                                    <kbd class="item-kbd">{cmd.shortcut}</kbd>
                                {/if}
                            </button>
                        {/each}
                    {/each}
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .palette-backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--z-modal);
        background: var(--scrim);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 18vh;
        animation: fadeIn var(--t-fast) var(--ease-out);
    }
    .palette {
        width: min(560px, calc(100vw - 2em));
        max-height: 64vh;
        background: #1a1a25;
        border: 1px solid var(--tint-2);
        border-radius: 8px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        color: var(--text-color);
        animation: popIn var(--t-base) var(--ease-out);
    }
    .search-row {
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.6em 0.9em;
        border-bottom: 1px solid var(--tint-1);
    }
    .search-icon {
        opacity: 0.5;
        font-size: 1.1em;
    }
    .search-row input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: inherit;
        font-size: 18px;
        font-family: inherit;
    }
    .hint-kbd, .item-kbd {
        background: var(--tint-2);
        border: 1px solid var(--tint-3);
        border-radius: 3px;
        padding: 0.05em 0.4em;
        font-size: 0.75em;
        font-family: monospace;
        color: rgba(205, 214, 244, 0.7);
    }
    .results {
        flex: 1;
        overflow-y: auto;
        padding: 0.3em 0;
    }
    .empty {
        padding: 1em;
        text-align: center;
        opacity: 0.5;
        font-size: 0.85em;
    }
    .group-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(205, 214, 244, 0.45);
        padding: 0.7em 1em 0.3em;
    }
    .item {
        display: flex;
        align-items: center;
        gap: 0.6em;
        width: 100%;
        background: none;
        border: none;
        color: inherit;
        text-align: left;
        font-size: 13px;
        height: 36px;
        padding: 0 1em;
        cursor: pointer;
        font-family: inherit;
    }
    .item-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .item.highlighted {
        background: var(--highlight-color);
        color: var(--background-color);
    }
    .item.highlighted .item-kbd {
        background: rgba(30, 30, 46, 0.15);
        border-color: rgba(30, 30, 46, 0.25);
        color: var(--background-color);
    }

</style>
