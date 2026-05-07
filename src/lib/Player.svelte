<script lang="ts">
    import FpsCounter from "./debug/FPSCounter.svelte";
    import FrametimeHistogram from "./debug/FrametimeHistogram.svelte";
    import { showFPS, showFrametimeHistogram, SelectedPaletteIndex, PALETTE_PRESETS, CgbColor, GhostingStrength, PixelPerfect, WakeLockEnabled, OrientationLockEnabled } from "stores/optionsStore";
    import LocalInputViewer from "./LocalInputViewer.svelte";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { onMount } from "svelte";
    import { AudioSuspended, Emulator } from "../emulator";
    import { EmulatorPaused, QuickSaveFlyer } from "stores/playStores";
    import { loadedCartridge, loadedBootRom } from "stores/romStores";
    import RomDropZone from "./RomDropZone.svelte";
    import BurgerMenu from "./BurgerMenu.svelte";
    import Window from "./Window.svelte";
    import RomsSection from "./RomsSection.svelte";
    import SavesViewer from "./SavesViewer.svelte";
    import OptionsView from "./OptionsView.svelte";
    import BindingsView from "./BindingsView.svelte";
    import AboutView from "./AboutView.svelte";
    import WindowSkeleton from "./WindowSkeleton.svelte";
    let DebugSection: any = $state(null);
    import { DragState } from "../types";
    import WebGLCanvas from "./WebGLCanvas.svelte";
    import { registerShadedCanvas } from "../screenshot";
    import { showRomsWindow, showSavesWindow, showOptionsWindow, showBindingsWindow, showDebugWindow, showAboutWindow } from "../stores/windowStores";
    import { ResolvedTheme } from "../stores/consoleThemeStore";
    import type { Writable } from "svelte/store";

    let dragState: DragState = $state(DragState.Idle);
    let webglCanvas: { draw: (frame: Uint8Array | Uint16Array) => void; getCanvas: () => HTMLCanvasElement } | null = $state(null);
    let menuOpen: boolean = $state(false);
    let screenEl: HTMLDivElement | undefined = $state();
    let screenTapEl: HTMLDivElement | undefined = $state();
    let burgerBtnEl: HTMLButtonElement | undefined = $state();
    let isFullscreen: boolean = $state(false);
    let isCoarsePointer: boolean = $state(false);

    const hasRom = $derived($loadedCartridge != undefined || $loadedBootRom != undefined);

    function toggleWindow(store: Writable<boolean>) {
        store.update(v => !v);
        menuOpen = false;
    }

    function toggleFullscreen() {
        menuOpen = false;
        if (!document.fullscreenElement) screenEl?.requestFullscreen();
        else document.exitFullscreen();
    }

    const menuItems = $derived([
        { label: 'ROMs',       active: $showRomsWindow,    toggle: () => toggleWindow(showRomsWindow) },
        { label: 'Saves',      active: $showSavesWindow,   toggle: () => toggleWindow(showSavesWindow), disabled: !hasRom },
        { label: 'Options',    active: $showOptionsWindow, toggle: () => toggleWindow(showOptionsWindow) },
        { label: 'Keyboard Bindings',   active: $showBindingsWindow,toggle: () => toggleWindow(showBindingsWindow) },
        { label: 'Debug',      active: $showDebugWindow,   toggle: () => toggleWindow(showDebugWindow) },
        { label: 'Fullscreen', active: isFullscreen,       toggle: toggleFullscreen },
        { label: 'About',      active: $showAboutWindow,   toggle: () => toggleWindow(showAboutWindow) },
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
        if ($showDebugWindow && !DebugSection) {
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
    class="console"
    role="main"
    tabindex="0"
    style={$ResolvedTheme.style}
    data-family={$ResolvedTheme.family.id}
    onkeydown={gameInputKeydownHandler}
    onkeyup={gameInputKeyupHandler}
>
    <div>
        <RomDropZone onRomReceived={Emulator.PlayRom} bind:dragState>
            <div
                class="screen"
                class:drop-allowed={dragState == DragState.Accept}
                class:drop-disallowed={dragState == DragState.Reject}
                bind:this={screenEl}
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
                {#if $showRomsWindow}
                    <Window title="ROMs Library" onclose={() => showRomsWindow.set(false)}>
                        <RomsSection />
                    </Window>
                {/if}
                {#if $showSavesWindow}
                    <Window title="Saves" onclose={() => showSavesWindow.set(false)}>
                        <SavesViewer />
                    </Window>
                {/if}
                {#if $showOptionsWindow}
                    <Window title="Options" onclose={() => showOptionsWindow.set(false)}>
                        <OptionsView />
                    </Window>
                {/if}
                {#if $showBindingsWindow}
                    <Window title="Keyboard Bindings" onclose={() => showBindingsWindow.set(false)}>
                        <BindingsView />
                    </Window>
                {/if}
                {#if $showAboutWindow}
                    <Window title="About SvelteBoy" onclose={() => showAboutWindow.set(false)}>
                        <AboutView />
                    </Window>
                {/if}
                {#if $showDebugWindow}
                    <Window title="Debug" onclose={() => showDebugWindow.set(false)} wide>
                        {#if DebugSection}
                            <DebugSection />
                        {:else}
                            <WindowSkeleton label="Loading debug tools…" />
                        {/if}
                    </Window>
                {/if}
            </div>
        </RomDropZone>
        <div class="menu-bar">
            <span class="console-name">{$ResolvedTheme.family.shellName}</span>
            {#if menuOpen}
                <div class="menu-backdrop" onclick={() => menuOpen = false} role="presentation" aria-hidden="true"></div>
            {/if}
            <div class="burger-wrap">
                {#if menuOpen}
                    <BurgerMenu items={menuItems} />
                {/if}
                <button class="burger-btn" onclick={() => menuOpen = !menuOpen} aria-label="Menu" bind:this={burgerBtnEl}>☰</button>
            </div>
        </div>
    </div>
    <LocalInputViewer />
</div>

<style>
    .console {
        /* Theme variables (defaults = DMG-01 Original) */
        --shell-bg: #bbb;
        --shell-radius: 2% 2% 9% 2%;
        --bezel-bg: #68717a;
        --bezel-radius: 1% 1% 4% 1%;
        --name-color: #12153d;
        --name-font: "Courier New", Courier, monospace;
        --name-style: italic;
        --button-label: #12153d;
        --dpad-plate-bg: #b2b2b2;
        --dpad-button: #000;
        --ss-button: #555;
        --ss-button-label: var(--button-label);
        --ab-plate-bg: #afafaf;
        --ab-button: #64213e;
        --ab-button-shape: 50%;
        --ab-button-label: var(--button-label);

        container-type: size;
        aspect-ratio: 9 / 13;
        background-color: var(--shell-bg);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        border-radius: var(--shell-radius);
        border: 4px solid transparent;
        gap: 10cqmin;
        padding: 8cqmin 0 0 0;
    }

    @media (orientation: landscape) {
        .console {
            height: calc(100dvh - var(--safe-top) - var(--safe-bottom));
            width: auto;
            /* aspect-ratio: 9 / 13; */
        }
    }
    @media (orientation: portrait) {
        .console {
            width: 100vw;
            height: auto;
            max-height: 100dvh;
            /* aspect-ratio: 9 / 13; */
        }
    }

    .console:focus,
    .console:focus-within {
        border-color: var(--highlight-color);
    }

    .screen {
        position: relative;
        padding: 2cqmin 5cqmin;
        background-color: var(--bezel-bg);
        border-radius: var(--bezel-radius);
    }

    .screen:fullscreen {
        padding: 0;
        margin: 0;
        background-color: #000;
        border-radius: 0;
        width: 100vw;
        height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .screen:fullscreen .screen-tap {
        width: 100%;
        height: 100%;
    }

    .screen.drop-allowed {
        background-color: #608cb8;
    }

    .screen.drop-disallowed {
        background-color: #7a6b68;
    }

    .fps-wrapper {
        position: absolute;
    }

    .frametime-wrapper {
        position: absolute;
        top: 0.05cqmin;
        left: 0.05cqmin;
        z-index: 5;
    }

    .audio-hint {
        position: absolute;
        bottom: 0.05cqmin;
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

    .menu-bar {
        display: flex;
        width: 100%;
        /* align-items: center; */
        padding: 0.2em 0.5em;
        margin-top: 0.5cqmin;
        gap: 0.5em;
    }

    .console-name {
        font-family: var(--name-font);
        color: var(--name-color);
        font-weight: bold;
        font-size: 6cqi;
        margin: 0 3% 0 5%;
        align-self: flex-start;
        font-style: var(--name-style);
        text-transform: uppercase;
    }

    .burger-wrap {
        position: relative;
        margin-left: auto;
        align-self: flex-start;
        display: flex;
    }

    .burger-btn {
        width: 6cqmin;
        height: 6cqmin;
        line-height: 1;
        background: rgba(0,0,0,0.4);
        border: none;
        color: #eee;
        font-size: 4cqmin;
        cursor: pointer;
        border-radius: 0.2em;
        padding: 0 0.3em;
        line-height: 1;
    }

    .burger-btn:hover {
        background: rgba(0,0,0,0.7);
    }

    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 199;
    }

    .screen-tap {
        position: relative;
        display: block;
        line-height: 0;
        width: 80cqmin;
        height: 72cqmin;
    }

    .screen:fullscreen .screen-tap {
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
</style>
