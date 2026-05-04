<script lang="ts">
    import FpsCounter from "./debug/FPSCounter.svelte";
    import FrametimeHistogram from "./debug/FrametimeHistogram.svelte";
    import { playerPixelSize, showFPS, showFrametimeHistogram, SelectedPaletteIndex, PALETTE_PRESETS, CgbColor, GhostingStrength, PixelPerfect } from "stores/optionsStore";
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
    import DebugSection from "./debug/DebugSection.svelte";
    import { DragState } from "../types";
    import WebGLCanvas from "./WebGLCanvas.svelte";
    import { registerShadedCanvas } from "../screenshot";
    import { showRomsWindow, showSavesWindow, showOptionsWindow, showBindingsWindow, showDebugWindow } from "../stores/windowStores";
    import type { Writable } from "svelte/store";

    let dragState: DragState = $state(DragState.Idle);
    let webglCanvas: { draw: (frame: Uint8Array | Uint16Array) => void; getCanvas: () => HTMLCanvasElement } | null = $state(null);
    let menuOpen: boolean = $state(false);
    let screenEl: HTMLDivElement | undefined = $state();
    let screenTapEl: HTMLDivElement | undefined = $state();
    let burgerBtnEl: HTMLButtonElement | undefined = $state();
    let isFullscreen: boolean = $state(false);

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
        { label: 'Bindings',   active: $showBindingsWindow,toggle: () => toggleWindow(showBindingsWindow) },
        { label: 'Debug',      active: $showDebugWindow,   toggle: () => toggleWindow(showDebugWindow) },
        { label: 'Fullscreen', active: isFullscreen,       toggle: toggleFullscreen },
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

        return () => {
            Emulator.RemoveRenderCallback(drawCallback);
            registerShadedCanvas(null);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
        };
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
    onkeydown={gameInputKeydownHandler}
    onkeyup={gameInputKeyupHandler}
>
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
                    pixelSize={$playerPixelSize}
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
            <button class="burger-btn" onclick={() => menuOpen = !menuOpen} aria-label="Menu" bind:this={burgerBtnEl}>☰</button>
            {#if menuOpen}
                <div class="menu-backdrop" onclick={() => menuOpen = false} role="presentation" aria-hidden="true"></div>
                <BurgerMenu items={menuItems} />
            {/if}
            {#if $showRomsWindow}
                <Window title="ROMs" onclose={() => showRomsWindow.set(false)}>
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
                <Window title="Bindings" onclose={() => showBindingsWindow.set(false)}>
                    <BindingsView />
                </Window>
            {/if}
            {#if $showDebugWindow}
                <Window title="Debug" onclose={() => showDebugWindow.set(false)} wide>
                    <DebugSection />
                </Window>
            {/if}
        </div>
    </RomDropZone>
    <span class="console-name">Svelte BOY</span>
    <LocalInputViewer />
</div>

<style>
    .console {
        position: relative;
        padding-top: 1em;
        background-color: #bbb;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 1em 1em 7em 1em;
        border: 4px solid transparent;
    }

    .console:focus,
    .console:focus-within {
        border-color: var(--highlight-color);
    }

    .console-name {
        font-family: "Courier New", Courier, monospace;
        color: #12153d;
        font-weight: bold;
        font-size: 3em;
        margin-left: 5%;
        align-self: flex-start;
        font-style: italic;
        text-transform: uppercase;
    }

    .screen {
        position: relative;
        padding: 2em 5em;
        background-color: #68717a;
        margin: 0.5em;
        border-radius: 1em 1em 4em 1em;
    }

    .screen:fullscreen {
        padding: 0;
        margin: 0;
        background-color: #000;
        border-radius: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .screen:fullscreen .screen-tap {
        width: 100%;
        height: 100%;
    }

    /* Canvas sizing handled inline by WebGLCanvas (pixel-perfect or fixed scale). */

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
        top: 0.4em;
        left: 0.4em;
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

    .burger-btn {
        position: absolute;
        top: 0.4em;
        right: 0.4em;
        background: rgba(0,0,0,0.4);
        border: none;
        color: #eee;
        font-size: 1.2em;
        cursor: pointer;
        border-radius: 0.3em;
        padding: 0.1em 0.3em;
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
    }

    .pause-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.45);
        color: rgba(255, 255, 255, 0.7);
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        font-size: 3em;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        pointer-events: none;
        user-select: none;
    }
</style>
