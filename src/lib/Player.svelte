<script lang="ts">
    import FpsCounter from "./debug/FPSCounter.svelte";
    import FrametimeHistogram from "./debug/FrametimeHistogram.svelte";
    import { showFPS, showFrametimeHistogram, SelectedPaletteIndex, PALETTE_PRESETS, CgbColor, GhostingStrength, PixelPerfect, WakeLockEnabled, OrientationLockEnabled } from "stores/optionsStore";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { onMount, untrack } from "svelte";
    import { AudioSuspended, Emulator } from "../emulator";
    import { EmulatorPaused, QuickSaveFlyer } from "stores/playStores";
    import { loadedCartridge, loadedBootRom } from "stores/romStores";
    import RomDropZone from "./RomDropZone.svelte";
    import Window from "./Window.svelte";
    import RomsSection from "./RomsSection.svelte";
    import SavesViewer from "./SavesViewer.svelte";
    import OptionsView from "./OptionsView.svelte";
    import BindingsView from "./BindingsView.svelte";
    import AboutView from "./AboutView.svelte";
    import WindowSkeleton from "./WindowSkeleton.svelte";
    import CheatsPanel from "./cheats/CheatsPanel.svelte";
    let DebugSection: any = $state(null);
    import { DragState, type LayoutId } from "../types";
    import WebGLCanvas from "./WebGLCanvas.svelte";
    import { registerShadedCanvas } from "../screenshot";
    import { showRomsWindow, showSavesWindow, showOptionsWindow, showBindingsWindow, showCheatsWindow, showAboutWindow } from "../stores/windowStores";
    import { SelectedLayout } from "../stores/layoutStore";
    import Layout from "./layouts/Layout.svelte";
    import type { Writable } from "svelte/store";

    let dragState: DragState = $state(DragState.Idle);
    let webglCanvas: { draw: (frame: Uint8Array | Uint16Array) => void; getCanvas: () => HTMLCanvasElement } | null = $state(null);
    let menuOpen: boolean = $state(false);
    let screenTapEl: HTMLDivElement | undefined = $state();
    let burgerBtnEl: HTMLButtonElement | null = $state(null);
    let fullscreenTargetEl: HTMLElement | null = $state(null);
    let isFullscreen: boolean = $state(false);
    let isCoarsePointer: boolean = $state(false);
    let savedLayout: LayoutId | null = null;

    const hasRom = $derived($loadedCartridge != undefined || $loadedBootRom != undefined);
    const layout = $derived($SelectedLayout);
    const showInlineDebug = $derived(layout === 'debug');

    function toggleWindow(store: Writable<boolean>) {
        store.update(v => !v);
        menuOpen = false;
    }

    function setLayout(id: LayoutId) {
        SelectedLayout.set(id);
        menuOpen = false;
    }

    function toggleFullscreen() {
        menuOpen = false;
        if (!document.fullscreenElement) fullscreenTargetEl?.requestFullscreen();
        else document.exitFullscreen();
    }

    const menuItems = $derived([
        { label: 'ROMs',       active: $showRomsWindow,    toggle: () => toggleWindow(showRomsWindow) },
        { label: 'Saves',      active: $showSavesWindow,   toggle: () => toggleWindow(showSavesWindow), disabled: !hasRom },
        { label: 'Cheats',     active: $showCheatsWindow,  toggle: () => toggleWindow(showCheatsWindow), disabled: !hasRom },
        { label: 'Options',    active: $showOptionsWindow, toggle: () => toggleWindow(showOptionsWindow) },
        { label: 'Keyboard Bindings', active: $showBindingsWindow, toggle: () => toggleWindow(showBindingsWindow) },
        { label: 'Fullscreen', active: isFullscreen,       toggle: toggleFullscreen },
        { label: 'About',      active: $showAboutWindow,   toggle: () => toggleWindow(showAboutWindow) },
        { header: 'Layout', label: 'Console',   active: layout === 'console',   toggle: () => setLayout('console') },
        { label: 'Compact',   active: layout === 'compact',   toggle: () => setLayout('compact') },
        { label: 'Debug',     active: layout === 'debug',     toggle: () => setLayout('debug') },
        { label: 'Immersive', active: layout === 'immersive', toggle: () => setLayout('immersive') },
    ]);

    onMount(() => {
        const drawCallback = () => {
            if (Emulator.IsCgbMode()) {
                webglCanvas?.draw(Emulator.GetCGBGameFrame());
            } else {
                webglCanvas?.draw(Emulator.GetGameFrame());
            }
        };
        Emulator.AddRenderCallback(drawCallback);
        registerShadedCanvas(() => webglCanvas?.getCanvas() ?? null);

        const onFullscreenChange = () => {
            isFullscreen = !!document.fullscreenElement;
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);

        const coarseMql = window.matchMedia('(pointer: coarse)');
        const updateCoarse = () => { isCoarsePointer = coarseMql.matches; };
        updateCoarse();
        coarseMql.addEventListener('change', updateCoarse);

        return () => {
            Emulator.RemoveRenderCallback(drawCallback);
            registerShadedCanvas(null);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            coarseMql.removeEventListener('change', updateCoarse);
        };
    });

    $effect(() => {
        if (showInlineDebug && !DebugSection) {
            import("./debug/DebugSection.svelte").then(m => DebugSection = m.default);
        }
    });

    $effect(() => {
        if (!isFullscreen) return;
        window.addEventListener('keydown', gameInputKeydownHandler);
        window.addEventListener('keyup', gameInputKeyupHandler);
        return () => {
            window.removeEventListener('keydown', gameInputKeydownHandler);
            window.removeEventListener('keyup', gameInputKeyupHandler);
        };
    });

    let wakeLock: WakeLockSentinel | null = null;

    async function acquireWakeLock() {
        if (wakeLock) return;
        if (!('wakeLock' in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch (_) { /* permission/denial: ignore */ }
    }
    async function releaseWakeLock() {
        if (!wakeLock) return;
        try { await wakeLock.release(); } catch (_) { /* ignore */ }
        wakeLock = null;
    }

    $effect(() => {
        if (!hasRom || !$WakeLockEnabled) {
            releaseWakeLock();
            return;
        }
        acquireWakeLock();
        const onVis = () => { if (document.visibilityState === 'visible') acquireWakeLock(); };
        document.addEventListener('visibilitychange', onVis);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            releaseWakeLock();
        };
    });

    $effect(() => {
        if (!isFullscreen || !isCoarsePointer || !$OrientationLockEnabled) return;
        const so = (screen as any).orientation;
        if (!so?.lock) return;
        so.lock('landscape').catch(() => { /* ignore */ });
        return () => { so.unlock?.(); };
    });

    $effect(() => {
        if (isFullscreen && isCoarsePointer && layout !== 'immersive') {
            untrack(() => { savedLayout = layout; });
            SelectedLayout.set('immersive');
        } else if (!isFullscreen && savedLayout && layout === 'immersive') {
            const restore = savedLayout;
            savedLayout = null;
            SelectedLayout.set(restore);
        }
    });

    $effect(() => {
        const data = $QuickSaveFlyer;
        if (!data || !screenTapEl || !burgerBtnEl) return;
        const from = screenTapEl.getBoundingClientRect();
        const to = burgerBtnEl.getBoundingClientRect();
        const targetSize = 16;
        const targetLeft = to.left + to.width / 2 - targetSize / 2;
        const targetTop = to.top + to.height / 2 - targetSize / 2;
        const dx = from.left - targetLeft;
        const dy = from.top - targetTop;
        const sx = from.width / targetSize;
        const sy = from.height / targetSize;
        const img = document.createElement('img');
        img.src = data.thumbnail;
        img.style.cssText = `position:fixed;pointer-events:none;z-index:1000;image-rendering:pixelated;border-radius:2px;box-shadow:0 0 12px rgba(0,0,0,0.7);transform-origin:top left;`;
        img.style.left = targetLeft + 'px';
        img.style.top = targetTop + 'px';
        img.style.width = targetSize + 'px';
        img.style.height = targetSize + 'px';
        document.body.appendChild(img);
        const anim = img.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 1 },
                { transform: 'none', opacity: 0 },
            ],
            { duration: 650, easing: 'cubic-bezier(0.4, 0.7, 0.5, 1)', fill: 'forwards' }
        );
        anim.onfinish = () => img.remove();
        anim.oncancel = () => img.remove();
    });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    class="player-root"
    role="main"
    tabindex="0"
    onkeydown={gameInputKeydownHandler}
    onkeyup={gameInputKeyupHandler}
>
    <Layout
        {layout}
        {menuItems}
        {menuOpen}
        onMenuToggle={() => menuOpen = !menuOpen}
        onMenuClose={() => menuOpen = false}
        burgerRef={(el) => burgerBtnEl = el}
        fullscreenTargetRef={(el) => fullscreenTargetEl = el}
        {screen}
        {windows}
        debugInline={showInlineDebug ? debugInline : undefined}
    />
</div>

{#snippet screen()}
    <RomDropZone onRomReceived={Emulator.PlayRom} bind:dragState extraClass="screen-fill">
        <div
            class="screen-content"
            class:drop-allowed={dragState == DragState.Accept}
            class:drop-disallowed={dragState == DragState.Reject}
        >
            <div
                class="screen-tap"
                ondblclick={toggleFullscreen}
                role="presentation"
                bind:this={screenTapEl}
            >
                <WebGLCanvas
                    bind:this={webglCanvas}
                    palette={PALETTE_PRESETS[$SelectedPaletteIndex]}
                    cgbColor={$CgbColor}
                    ghostingStrength={$GhostingStrength}
                    pixelPerfect={$PixelPerfect}
                />
                {#if $EmulatorPaused && hasRom}
                    <div class="pause-overlay">PAUSE</div>
                {/if}
            </div>
            {#if $showFPS}
                <div class="fps-wrapper">
                    <FpsCounter />
                </div>
            {/if}
            {#if $showFrametimeHistogram}
                <div class="frametime-wrapper">
                    <FrametimeHistogram />
                </div>
            {/if}
            {#if $AudioSuspended && !$EmulatorPaused}
                <button class="audio-hint" onclick={() => {}} aria-label="Enable audio">
                    🔇 Click to enable sound
                </button>
            {/if}
        </div>
    </RomDropZone>
{/snippet}

{#snippet windows(mode: 'modal' | 'docked')}
    {#if $showRomsWindow}
        <Window {mode} title="ROMs Library" onclose={() => showRomsWindow.set(false)}>
            <RomsSection />
        </Window>
    {/if}
    {#if $showSavesWindow}
        <Window {mode} title="Saves" onclose={() => showSavesWindow.set(false)}>
            <SavesViewer />
        </Window>
    {/if}
    {#if $showCheatsWindow}
        <Window {mode} title="Cheats" onclose={() => showCheatsWindow.set(false)}>
            <CheatsPanel />
        </Window>
    {/if}
    {#if $showOptionsWindow}
        <Window {mode} title="Options" onclose={() => showOptionsWindow.set(false)}>
            <OptionsView />
        </Window>
    {/if}
    {#if $showBindingsWindow}
        <Window {mode} title="Keyboard Bindings" onclose={() => showBindingsWindow.set(false)}>
            <BindingsView />
        </Window>
    {/if}
    {#if $showAboutWindow}
        <Window title="About SvelteBoy" onclose={() => showAboutWindow.set(false)}>
            <AboutView />
        </Window>
    {/if}
{/snippet}

{#snippet debugInline()}
    {#if DebugSection}
        <DebugSection />
    {:else}
        <WindowSkeleton label="Loading debug tools…" />
    {/if}
{/snippet}

<style>
    .player-root {
        outline: none;
    }

    :global(.screen-fill) {
        width: 100%;
        height: 100%;
    }

    .screen-content {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .screen-content.drop-allowed {
        background-color: #608cb8;
    }

    .screen-content.drop-disallowed {
        background-color: #7a6b68;
    }

    .screen-tap {
        position: relative;
        display: block;
        line-height: 0;
        width: 100%;
        height: 100%;
    }

    .pause-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.4);
        color: rgba(255, 255, 255, 0.4);
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        font-size: 15cqmin;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        pointer-events: none;
        user-select: none;
    }

    .fps-wrapper {
        position: absolute;
        top: 0;
        left: 0;
    }

    .frametime-wrapper {
        position: absolute;
        top: 0.05cqmin;
        left: 0.05cqmin;
        z-index: 5;
    }

    .audio-hint {
        position: absolute;
        bottom: 0.5em;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.75);
        border: none;
        color: #fff;
        font-size: 0.85em;
        cursor: pointer;
        border-radius: 0.4em;
        padding: 0.3em 0.7em;
        white-space: nowrap;
        z-index: 10;
    }

    .audio-hint:hover {
        background: rgba(0,0,0,0.9);
    }
</style>
