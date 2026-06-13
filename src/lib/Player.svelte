<script lang="ts">
    import FrametimeHistogram from "./debug/FrametimeHistogram.svelte";
    import {
        showFrametimeHistogram,
        SelectedPaletteIndex,
        PALETTE_PRESETS,
        CgbColor,
        GhostingStrength,
        PixelPerfect,
        WakeLockEnabled,
        OrientationLockEnabled,
    } from "stores/optionsStore";
    import HudOverlay from "./hud/HudOverlay.svelte";
    import LocalInputViewer from "./LocalInputViewer.svelte";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { onMount } from "svelte";
    import { AudioSuspended, Emulator } from "../emulator";
    import { EmulatorPaused, QuickSaveFlyer } from "stores/playStores";
    import { loadedCartridge, loadedBootRom } from "stores/romStores";
    import RomDropZone from "./RomDropZone.svelte";
    import BurgerMenu from "./BurgerMenu.svelte";
    import PlaySheet from "./PlaySheet.svelte";
    import { DragState } from "../types";
    import WebGLCanvas from "./WebGLCanvas.svelte";
    import { registerShadedCanvas } from "../screenshot";
    import {
        showSavesWindow,
        showOptionsWindow,
        showBindingsWindow,
        showDebugWindow,
        showAboutWindow,
        selectedRomSha1,
    } from "stores/windowStores";
    import { goToHome } from "stores/viewStore";
    import { openPalette } from "stores/paletteStore";

    const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    const PALETTE_HINT = IS_MAC ? "⌘K" : "Ctrl+K";

    let dragState: DragState = $state(DragState.Idle);
    let webglCanvas: { draw: (frame: Uint8Array | Uint16Array) => void; getCanvas: () => HTMLCanvasElement } | null = $state(null);
    let menuOpen: boolean = $state(false);
    let sheetOpen: boolean = $state(false);
    let screenEl: HTMLDivElement | undefined = $state();
    let screenTapEl: HTMLDivElement | undefined = $state();
    let burgerBtnEl: HTMLButtonElement | undefined = $state();
    let isFullscreen: boolean = $state(false);
    let isCoarsePointer: boolean = $state(false);

    const DOUBLE_TAP_MS = 280;
    let lastTapTime = 0;
    let pendingTapTimer: ReturnType<typeof setTimeout> | null = null;

    function onScreenTap(e: MouseEvent) {
        // Desktop: rely on ondblclick for fullscreen, no sheet on single-click.
        if (!isCoarsePointer) return;
        if (!hasRom) return;
        e.preventDefault();
        const now = Date.now();
        if (now - lastTapTime < DOUBLE_TAP_MS) {
            // Double-tap → fullscreen, cancel pending sheet
            if (pendingTapTimer) { clearTimeout(pendingTapTimer); pendingTapTimer = null; }
            lastTapTime = 0;
            toggleFullscreen();
            return;
        }
        lastTapTime = now;
        if (pendingTapTimer) clearTimeout(pendingTapTimer);
        pendingTapTimer = setTimeout(() => {
            sheetOpen = true;
            pendingTapTimer = null;
        }, DOUBLE_TAP_MS);
    }

    const hasRom = $derived($loadedCartridge != undefined || $loadedBootRom != undefined);

    function toggleFullscreen() {
        menuOpen = false;
        if (!document.fullscreenElement) screenEl?.requestFullscreen();
        else document.exitFullscreen();
    }

    function back() {
        menuOpen = false;
        goToHome();
    }

    function openCommandPalette() {
        menuOpen = false;
        openPalette();
    }

    const menuItems = $derived([
        { label: 'Library',    active: false,        toggle: back },
        { label: 'Commands…',  active: false,        toggle: openCommandPalette },
        { label: 'Fullscreen', active: isFullscreen, toggle: toggleFullscreen },
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

    const anyOverlayOpen = $derived(
        menuOpen
        || $showSavesWindow
        || $showOptionsWindow
        || $showBindingsWindow
        || $showDebugWindow
        || $showAboutWindow
        || $selectedRomSha1 != undefined
    );

    $effect(() => {
        if (anyOverlayOpen) return;
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

<div class="play-shell" role="main">
    <header class="play-topbar">
        <button class="back-btn" onclick={back} aria-label="Back to library">←</button>
        <span class="play-title">{$loadedCartridge?.name ?? 'SvelteBoy'}</span>
        <button class="palette-chip" onclick={openPalette} aria-label="Open command palette">
            <span class="palette-chip-icon">⌕</span>
            <kbd>{PALETTE_HINT}</kbd>
        </button>
        {#if menuOpen}
            <div class="menu-backdrop" onclick={() => menuOpen = false} role="presentation" aria-hidden="true"></div>
        {/if}
        <div class="burger-wrap">
            {#if menuOpen}
                <BurgerMenu items={menuItems} />
            {/if}
            <button
                class="burger-btn"
                onclick={() => menuOpen = !menuOpen}
                aria-label="Menu"
                bind:this={burgerBtnEl}
            >☰</button>
        </div>
    </header>

    <RomDropZone onRomReceived={Emulator.PlayRom} bind:dragState>
        <div
            class="play-stage"
            class:drop-allowed={dragState == DragState.Accept}
            class:drop-disallowed={dragState == DragState.Reject}
            bind:this={screenEl}
        >
            <div
                class="screen-tap"
                ondblclick={toggleFullscreen}
                onclick={onScreenTap}
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
                <HudOverlay />
            </div>
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

    {#if isCoarsePointer}
        <div class="play-controls">
            <LocalInputViewer />
        </div>
    {/if}
</div>

<PlaySheet
    open={sheetOpen}
    onclose={() => sheetOpen = false}
    onfullscreen={toggleFullscreen}
    {isFullscreen}
/>

<style>
    .play-shell {
        min-height: 100dvh;
        background: var(--page-bg, #0a0a12);
        color: var(--text-color);
        display: flex;
        flex-direction: column;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
    .play-shell:focus,
    .play-shell:focus-within {
        outline: none;
    }

    .play-topbar {
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.4em 0.7em;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid var(--tint-1);
        backdrop-filter: blur(8px);
        position: sticky;
        top: 0;
        z-index: 50;
    }

    .back-btn {
        background: var(--tint-1);
        border: none;
        color: var(--text-color);
        font-size: 1em;
        padding: 0.2em 0.55em;
        border-radius: 0.3em;
        cursor: pointer;
        line-height: 1;
    }
    .back-btn:hover {
        background: var(--tint-3);
    }

    .play-title {
        font-weight: 600;
        font-size: 0.95em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60vw;
    }

    .palette-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35em;
        background: var(--tint-1);
        border: 1px solid var(--tint-2);
        color: rgba(205, 214, 244, 0.75);
        font-size: 0.75em;
        padding: 0.15em 0.5em;
        border-radius: 0.3em;
        cursor: pointer;
        line-height: 1;
    }
    .play-title ~ .palette-chip { margin-left: auto; }
    .palette-chip:hover {
        background: rgba(255, 255, 255, 0.1);
        color: inherit;
    }
    .palette-chip-icon { font-size: 1em; opacity: 0.7; }
    .palette-chip kbd {
        font-family: monospace;
        font-size: 0.9em;
        opacity: 0.85;
    }
    @media (pointer: coarse) {
        .palette-chip { display: none; }
    }

    .burger-wrap {
        position: relative;
        margin-left: auto;
        display: flex;
    }
    .palette-chip + .burger-wrap { margin-left: 0.5em; }
    .burger-btn {
        background: var(--tint-1);
        border: none;
        color: var(--text-color);
        font-size: 1.1em;
        cursor: pointer;
        border-radius: 0.3em;
        padding: 0.15em 0.5em;
        line-height: 1;
    }
    .burger-btn:hover {
        background: var(--tint-3);
    }

    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 199;
    }

    .play-stage {
        flex: 1;
        min-height: 0;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5em;
    }
    .play-stage.drop-allowed {
        background-color: rgba(96, 140, 184, 0.25);
    }
    .play-stage.drop-disallowed {
        background-color: rgba(122, 107, 104, 0.25);
    }

    .play-stage:fullscreen {
        padding: 0;
        background: #000;
        width: 100vw;
        height: 100dvh;
    }
    .play-stage:fullscreen .screen-tap {
        width: 100%;
        height: 100%;
    }

    .screen-tap {
        position: relative;
        display: block;
        line-height: 0;
        width: min(100%, 100dvh * 10 / 9);
        aspect-ratio: 10 / 9;
        max-height: 100%;
    }

    .frametime-wrapper {
        position: absolute;
        top: 0.05cqmin;
        left: 0.05cqmin;
        z-index: 5;
        pointer-events: none;
    }

    .audio-hint {
        position: absolute;
        bottom: 0.6em;
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

    .play-controls {
        container-type: inline-size;
        width: 100%;
        max-width: 720px;
        align-self: center;
        padding-bottom: env(safe-area-inset-bottom);
    }
</style>
