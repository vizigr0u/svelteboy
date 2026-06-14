<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Icon from "./icons/Icon.svelte";
    import NowPlayingTab from "./overlay/NowPlayingTab.svelte";
    import LibraryTab from "./overlay/LibraryTab.svelte";
    import OptionsTab from "./overlay/OptionsTab.svelte";
    import { overlayOpen, overlayTab, closeOverlay, type OverlayTab } from "stores/overlayStore";

    const TABS: { key: OverlayTab; label: string }[] = [
        { key: "now", label: "Now Playing" },
        { key: "library", label: "Library" },
        { key: "options", label: "Options" },
    ];

    function onKey(e: KeyboardEvent) {
        if (!$overlayOpen) return;
        if (e.key === "Escape") {
            e.stopPropagation();
            closeOverlay();
        }
    }

    function onBackdrop(e: MouseEvent) {
        if (e.target === e.currentTarget) closeOverlay();
    }

    // Swipe-down to dismiss on the mobile handle.
    let dragStartY = 0;
    let dragDy = $state(0);
    let dragging = $state(false);

    function onHandleDown(e: PointerEvent) {
        dragging = true;
        dragStartY = e.clientY;
        dragDy = 0;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
    function onHandleMove(e: PointerEvent) {
        if (!dragging) return;
        dragDy = Math.max(0, e.clientY - dragStartY);
    }
    function onHandleUp() {
        if (!dragging) return;
        dragging = false;
        if (dragDy > 80) closeOverlay();
        dragDy = 0;
    }

    onMount(() => window.addEventListener("keydown", onKey, true));
    onDestroy(() => window.removeEventListener("keydown", onKey, true));
</script>

{#if $overlayOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="overlay-backdrop" onclick={onBackdrop}>
        <div
            class="overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Game menu"
            style:transform={dragDy ? `translateY(${dragDy}px)` : undefined}
            class:dragging
        >
            <div
                class="sheet-handle"
                aria-hidden="true"
                onpointerdown={onHandleDown}
                onpointermove={onHandleMove}
                onpointerup={onHandleUp}
                onpointercancel={onHandleUp}
            ></div>
            <div class="tab-strip" role="tablist">
                {#each TABS as t}
                    <button
                        class="tab-btn"
                        class:active={$overlayTab === t.key}
                        role="tab"
                        aria-selected={$overlayTab === t.key}
                        onclick={() => overlayTab.set(t.key)}
                    >{t.label}</button>
                {/each}
                <button class="close-btn" onclick={closeOverlay} aria-label="Close">
                    <Icon name="xmark" />
                </button>
            </div>
            <div class="overlay-body">
                {#if $overlayTab === "now"}
                    <NowPlayingTab />
                {:else if $overlayTab === "library"}
                    <LibraryTab />
                {:else}
                    <OptionsTab />
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .overlay-backdrop {
        position: fixed;
        inset: 0;
        z-index: 160;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease-out;
    }
    .overlay-panel {
        background: #1e1e2e;
        color: #cdd6f4;
        width: min(720px, 94vw);
        max-height: 88vh;
        border-radius: 0.8em;
        border: 1px solid #45475a;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: scaleIn 0.16s cubic-bezier(0.2, 0.8, 0.3, 1);
    }
    .overlay-panel.dragging { animation: none; transition: none; }
    .sheet-handle {
        display: none;
        width: 40px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.25);
        margin: 0.5em auto 0.2em;
        touch-action: none;
        cursor: grab;
    }
    .tab-strip {
        display: flex;
        align-items: center;
        border-bottom: 1px solid #45475a;
        background: #181825;
        padding-right: 0.4em;
    }
    .tab-btn {
        flex: 1;
        background: none;
        border: none;
        color: #888;
        padding: 0.85em 0.5em;
        cursor: pointer;
        font-size: 0.95em;
        border-bottom: 2px solid transparent;
    }
    .tab-btn.active {
        color: #cdd6f4;
        border-bottom-color: var(--highlight-color, #89b4fa);
    }
    .tab-btn:hover:not(.active) { color: #b0b0b0; }
    .close-btn {
        background: none;
        border: none;
        color: #cdd6f4;
        cursor: pointer;
        font-size: 1.1em;
        padding: 0.3em 0.5em;
        flex: 0 0 auto;
    }
    .close-btn:hover { color: #f38ba8; }
    .overlay-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 1em;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.96); }
        to   { opacity: 1; transform: scale(1); }
    }

    /* Mobile: bottom sheet */
    @media (pointer: coarse), (max-width: 600px) {
        .overlay-backdrop { align-items: flex-end; }
        .overlay-panel {
            width: 100vw;
            max-height: 85dvh;
            border-radius: 1em 1em 0 0;
            border: none;
            animation: slideUp 0.22s cubic-bezier(0.2, 0.8, 0.3, 1);
        }
        .sheet-handle { display: block; }
    }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>
