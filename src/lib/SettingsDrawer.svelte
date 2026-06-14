<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Icon from "./icons/Icon.svelte";
    import GeneralPane from "./drawer/GeneralPane.svelte";
    import GamePane from "./drawer/GamePane.svelte";
    import { drawerOpen, drawerTab, closeDrawer, openDrawer, type DrawerTab } from "stores/playUiStore";

    const TABS: { key: DrawerTab; label: string }[] = [
        { key: "game", label: "Game" },
        { key: "general", label: "General" },
    ];

    let isLandscape = $state(false);
    $effect(() => {
        const mql = window.matchMedia("(orientation: landscape)");
        const upd = () => (isLandscape = mql.matches);
        upd();
        mql.addEventListener("change", upd);
        return () => mql.removeEventListener("change", upd);
    });

    function onKey(e: KeyboardEvent) {
        if (!$drawerOpen) return;
        if (e.key === "Escape") { e.stopPropagation(); closeDrawer(); }
    }

    // Swipe-down on the handle dismisses the sheet.
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
        if (dragDy > 80) closeDrawer();
        dragDy = 0;
    }

    onMount(() => window.addEventListener("keydown", onKey, true));
    onDestroy(() => window.removeEventListener("keydown", onKey, true));
</script>

{#if $drawerOpen}
    <!-- No scrim: drawer is opaque and only covers all-but-game-view; the game
         stays visible and interactive beside/below the sheet. -->
    <div class="drawer-root" class:landscape={isLandscape}>
        <div
            class="drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            style:transform={dragDy && !isLandscape ? `translateY(${dragDy}px)` : undefined}
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
                        class:active={$drawerTab === t.key}
                        role="tab"
                        aria-selected={$drawerTab === t.key}
                        onclick={() => openDrawer(t.key)}
                    >{t.label}</button>
                {/each}
                <button class="close-btn" onclick={closeDrawer} aria-label="Close">
                    <Icon name="xmark" />
                </button>
            </div>
            <div class="drawer-body">
                {#if $drawerTab === "general"}
                    <GeneralPane />
                {:else}
                    <GamePane />
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .drawer-root {
        position: fixed;
        inset: 0;
        z-index: 160;
        pointer-events: none;
        display: flex;
        align-items: flex-end;
        justify-content: center;
    }
    .drawer-root.landscape { align-items: stretch; justify-content: flex-start; }

    /* Full-surface drawer fills its split region (opaque), pairing with the ~1/3
       mini-console stage Player leaves: portrait = full width × bottom 66dvh;
       short content top-aligns, leftover is drawer bg (no gap, no click-through).
       Body scrolls if overflow. */
    .drawer-panel {
        pointer-events: auto;
        background: #1e1e2e;
        color: #cdd6f4;
        width: 100vw;
        height: 66dvh;
        border-radius: 1em 1em 0 0;
        border-top: 1px solid #45475a;
        box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 0.24s cubic-bezier(0.2, 0.8, 0.3, 1);
    }
    /* Landscape: left side-drawer fills the freed left 66vw, full height. */
    .drawer-root.landscape .drawer-panel {
        width: 66vw;
        height: 100dvh;
        border-radius: 0 1em 1em 0;
        border-top: none;
        border-right: 1px solid #45475a;
        box-shadow: 8px 0 32px rgba(0, 0, 0, 0.5);
        animation: slideLeft 0.24s cubic-bezier(0.2, 0.8, 0.3, 1);
    }
    .drawer-panel.dragging { animation: none; transition: none; }
    @media (prefers-reduced-motion: reduce) {
        .drawer-panel { animation: none; }
    }
    .sheet-handle {
        width: 40px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.25);
        margin: 0.5em auto 0.2em;
        touch-action: none;
        cursor: grab;
    }
    .drawer-root.landscape .sheet-handle { display: none; }
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
    .tab-btn.active { color: #cdd6f4; border-bottom-color: var(--highlight-color, #89b4fa); }
    .tab-btn:hover:not(.active) { color: #b0b0b0; }
    .close-btn {
        background: none; border: none; color: #cdd6f4;
        cursor: pointer; font-size: 1.1em; padding: 0.3em 0.5em; flex: 0 0 auto;
    }
    .close-btn:hover { color: #f38ba8; }
    .drawer-body { flex: 1; min-height: 0; overflow-y: auto; padding: 1em; }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes slideLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
</style>
