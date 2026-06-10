<script lang="ts">
    import Icon from "./icons/Icon.svelte";
    import type { IconName } from "./icons/Icon.svelte";
    import { Emulator } from "../emulator";
    import { EmulatorPaused } from "stores/playStores";
    import {
        showSavesWindow,
        showOptionsWindow,
        showBindingsWindow,
        showAboutWindow,
    } from "stores/windowStores";
    import { goToHome } from "stores/viewStore";
    import { pauseEmulator, unPauseEmulator } from "../emulator/lifecycle";

    interface Props {
        open: boolean;
        onclose: () => void;
        onfullscreen: () => void;
        isFullscreen: boolean;
    }

    let { open, onclose, onfullscreen, isFullscreen }: Props = $props();

    const QUICK_SLOT = 1;

    function close() { onclose(); }

    function togglePause() {
        if ($EmulatorPaused) unPauseEmulator();
        else pauseEmulator();
        close();
    }
    async function quickSave() {
        await Emulator.QuickSave(QUICK_SLOT);
        close();
    }
    async function quickLoad() {
        await Emulator.QuickLoad(QUICK_SLOT);
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
        { label: 'Quick save (slot 1)', icon: 'bookmark', onclick: quickSave },
        { label: 'Quick load (slot 1)', icon: 'bookmark', onclick: quickLoad },
        { label: 'Saves…',     icon: 'bookmark', onclick: openSaves },
        { label: 'Options…',   icon: 'filter',  onclick: openOptions },
        { label: 'Bindings…',  icon: 'filter',  onclick: openBindings },
        { label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen', icon: 'rotate', onclick: fullscreen },
        { label: 'About…',     icon: 'question', onclick: openAbout },
        { label: 'Back to library', icon: 'xmark', onclick: back, emphasis: 'danger' },
    ]);
</script>

{#if open}
    <div class="sheet-backdrop" onclick={close} role="presentation"></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Quick actions">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-body">
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
    .sheet-backdrop {
        position: fixed;
        inset: 0;
        z-index: 180;
        background: rgba(0, 0, 0, 0.45);
        animation: fadeIn 0.15s ease-out;
    }
    .sheet {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 181;
        background: #1e1e2e;
        color: #cdd6f4;
        border-radius: 1em 1em 0 0;
        box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
        padding: 0.5em 0.6em calc(1em + env(safe-area-inset-bottom));
        max-height: 70dvh;
        overflow-y: auto;
        animation: slideUp 0.22s cubic-bezier(0.2, 0.8, 0.3, 1);
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
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
        font-weight: 600;
    }
    .sheet-item.primary:hover {
        filter: brightness(1.08);
    }
    .sheet-item.danger {
        color: #f38ba8;
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

    @keyframes slideUp {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
    }
</style>
