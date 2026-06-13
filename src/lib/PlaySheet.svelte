<script lang="ts">
    import Icon from "./icons/Icon.svelte";
    import type { IconName } from "./icons/Icon.svelte";
    import { EmulatorPaused } from "stores/playStores";
    import {
        showSavesWindow,
        showOptionsWindow,
        showBindingsWindow,
        showAboutWindow,
    } from "stores/windowStores";
    import { goToHome } from "stores/viewStore";
    import { pauseEmulator, unPauseEmulator } from "../emulator/lifecycle";
    import { prefsForRom, loadedCartridge } from "stores/romStores";
    import SaveSlotPanel from "./SaveSlotPanel.svelte";

    interface Props {
        open: boolean;
        onclose: () => void;
        onfullscreen: () => void;
        isFullscreen: boolean;
    }

    let { open, onclose, onfullscreen, isFullscreen }: Props = $props();

    let slotsOpen = $state(false);
    let cart = $derived($loadedCartridge);
    let prefs = $derived(cart ? prefsForRom(cart.sha1) : null);
    let slotCount = $derived(prefs ? ($prefs?.quickSaveSlotCount ?? 9) : 9);

    function close() { onclose(); }

    function togglePause() {
        if ($EmulatorPaused) unPauseEmulator();
        else pauseEmulator();
        close();
    }
    function openSaves() { showSavesWindow.set(true); close(); }
    function openOptions() { showOptionsWindow.set(true); close(); }
    function openBindings() { showBindingsWindow.set(true); close(); }
    function openAbout() { showAboutWindow.set(true); close(); }
    function fullscreen() { onfullscreen(); close(); }
    function back() { goToHome(); close(); }

    type Action = { label: string; icon: IconName; onclick: () => void; emphasis?: 'primary' | 'danger' };
    let actions = $derived<Action[]>([
        $EmulatorPaused
            ? { label: 'Resume', icon: 'circle-play', onclick: togglePause, emphasis: 'primary' }
            : { label: 'Pause',  icon: 'circle-play', onclick: togglePause },
        { label: 'Saves…',     icon: 'bookmark', onclick: openSaves },
        { label: 'Options…',   icon: 'filter',  onclick: openOptions },
        { label: 'Bindings…',  icon: 'filter',  onclick: openBindings },
        { label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen', icon: 'rotate', onclick: fullscreen },
        { label: 'About…',     icon: 'question', onclick: openAbout },
        { label: 'Back to library', icon: 'xmark', onclick: back, emphasis: 'danger' },
    ]);
</script>

{#if open}
    <div class="scrim sheet-backdrop" onclick={close} role="presentation"></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Quick actions">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-body">
            {#if cart}
                <button
                    class="sheet-item"
                    onclick={() => slotsOpen = !slotsOpen}
                    aria-expanded={slotsOpen}
                >
                    <span class="sheet-icon"><Icon name="bookmark" /></span>
                    <span class="sheet-label">Quick saves</span>
                    <span class="disclosure">{slotsOpen ? '−' : '+'}</span>
                </button>
                {#if slotsOpen}
                    <div class="slots-wrap">
                        <SaveSlotPanel {slotCount} onaction={close} />
                    </div>
                {/if}
            {/if}
            {#each actions as a}
                <button
                    class="sheet-item"
                    class:primary={a.emphasis === 'primary'}
                    class:danger={a.emphasis === 'danger'}
                    onclick={a.onclick}
                >
                    <span class="sheet-icon"><Icon name={a.icon} /></span>
                    <span class="sheet-label">{a.label}</span>
                </button>
            {/each}
        </div>
    </div>
{/if}

<style>
    /* .scrim supplies fixed/inset/z/bg; local = entrance anim */
    .sheet-backdrop {
        animation: fadeIn var(--t-fast) var(--ease-out);
    }
    .sheet {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: var(--z-modal);
        background: var(--background-color);
        color: var(--text-color);
        border-radius: 1em 1em 0 0;
        box-shadow: 0 -8px 32px var(--scrim);
        padding: 0.5em 0.6em calc(1em + env(safe-area-inset-bottom));
        max-height: 70dvh;
        overflow-y: auto;
        animation: slideUp var(--t-slow) var(--ease-out);
    }
    .sheet-handle {
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255,255,255,0.25);
        margin: 0.2em auto 0.6em;
    }
    .sheet-body {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
    }
    .sheet-item {
        display: flex;
        align-items: center;
        gap: 0.7em;
        width: 100%;
        background: none;
        border: none;
        color: inherit;
        padding: 0.75em 0.6em;
        text-align: left;
        font-size: 1em;
        cursor: pointer;
        border-radius: 0.4em;
    }
    .sheet-item:hover, .sheet-item:active {
        background: rgba(255,255,255,0.07);
    }
    .sheet-item.primary {
        background: var(--highlight-color);
        color: var(--background-color);
        font-weight: 600;
    }
    .sheet-item.primary:hover {
        filter: brightness(1.08);
    }
    .sheet-item.danger {
        color: var(--danger-color);
    }
    .sheet-item.danger:hover {
        background: rgba(243, 139, 168, 0.12);
    }
    .sheet-icon {
        display: inline-flex;
        width: 1.3em;
        justify-content: center;
        opacity: 0.85;
    }
    .disclosure {
        margin-left: auto;
        font-family: monospace;
        opacity: 0.6;
        font-size: 1.1em;
    }
    .slots-wrap {
        padding: 0.3em 0.6em 0.6em;
    }

</style>
