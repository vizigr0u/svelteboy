<script lang="ts">
    import RomsSection from "./RomsSection.svelte";
    import BurgerMenu from "./BurgerMenu.svelte";
    import { loadedCartridge } from "stores/romStores";
    import { goToPlay } from "stores/viewStore";
    import {
        showSavesWindow,
        showOptionsWindow,
        showBindingsWindow,
        showDebugWindow,
        showAboutWindow,
    } from "stores/windowStores";
    import type { Writable } from "svelte/store";

    let menuOpen: boolean = $state(false);

    const hasRom = $derived($loadedCartridge != undefined);

    function toggleWindow(store: Writable<boolean>) {
        store.update(v => !v);
        menuOpen = false;
    }

    function resume() {
        menuOpen = false;
        goToPlay();
    }

    const menuItems = $derived([
        ...(hasRom ? [{ label: 'Resume playing', active: false, toggle: resume }] : []),
        { label: 'Saves',     active: $showSavesWindow,    toggle: () => toggleWindow(showSavesWindow), disabled: !hasRom },
        { label: 'Options',   active: $showOptionsWindow,  toggle: () => toggleWindow(showOptionsWindow) },
        { label: 'Bindings',  active: $showBindingsWindow, toggle: () => toggleWindow(showBindingsWindow) },
        { label: 'Debug',     active: $showDebugWindow,    toggle: () => toggleWindow(showDebugWindow) },
        { label: 'About',     active: $showAboutWindow,    toggle: () => toggleWindow(showAboutWindow) },
    ]);
</script>

<div class="home-hub">
    <header class="home-header">
        <span class="brand">SvelteBoy</span>
        {#if hasRom}
            <button class="resume-pill" onclick={resume}>
                ▶ Resume <span class="resume-title">{$loadedCartridge?.name}</span>
            </button>
        {/if}
        {#if menuOpen}
            <div class="menu-backdrop" onclick={() => menuOpen = false} role="presentation" aria-hidden="true"></div>
        {/if}
        <div class="burger-wrap">
            {#if menuOpen}
                <BurgerMenu items={menuItems} />
            {/if}
            <button class="burger-btn" onclick={() => menuOpen = !menuOpen} aria-label="Menu">☰</button>
        </div>
    </header>
    <main class="home-main">
        <RomsSection />
    </main>
</div>

<style>
    .home-hub {
        min-height: 100dvh;
        background: var(--page-bg, #0f0f17);
        color: var(--text-color, #cdd6f4);
        display: flex;
        flex-direction: column;
    }

    .home-header {
        display: flex;
        align-items: center;
        gap: 0.8em;
        padding: 0.6em 1em;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        position: sticky;
        top: 0;
        z-index: 50;
        backdrop-filter: blur(8px);
    }

    .brand {
        font-weight: 700;
        font-size: 1.05em;
        letter-spacing: 0.02em;
    }

    .resume-pill {
        margin-left: auto;
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
        border: none;
        border-radius: 999px;
        padding: 0.3em 0.9em;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
        max-width: 50vw;
    }
    .resume-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 14em;
        font-weight: 500;
        opacity: 0.85;
    }

    .burger-wrap {
        position: relative;
        margin-left: auto;
        display: flex;
    }
    .resume-pill + .burger-wrap {
        margin-left: 0;
    }
    .burger-btn {
        background: rgba(255, 255, 255, 0.06);
        border: none;
        color: var(--text-color, #cdd6f4);
        font-size: 1.1em;
        cursor: pointer;
        border-radius: 0.3em;
        padding: 0.15em 0.5em;
        line-height: 1;
    }
    .burger-btn:hover {
        background: rgba(255, 255, 255, 0.12);
    }

    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 199;
    }

    .home-main {
        flex: 1;
        min-height: 0;
    }
</style>
