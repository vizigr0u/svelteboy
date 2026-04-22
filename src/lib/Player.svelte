<script lang="ts">
    import PlayerControls from "./PlayerControls.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
    import { playerPixelSize, showFPS, SelectedPaletteIndex, PALETTE_PRESETS } from "stores/optionsStore";
    import LocalInputViewer from "./LocalInputViewer.svelte";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { onMount } from "svelte";
    import { Emulator } from "../emulator";
    import RomDropZone from "./RomDropZone.svelte";
    import BurgerMenu from "./BurgerMenu.svelte";
    import Window from "./Window.svelte";
    import RomsSection from "./RomsSection.svelte";
    import SavesViewer from "./SavesViewer.svelte";
    import OptionsView from "./OptionsView.svelte";
    import DebugSection from "./debug/DebugSection.svelte";
    import { DragState } from "../types";
    import WebGLCanvas from "./WebGLCanvas.svelte";
    import { showRomsWindow, showSavesWindow, showOptionsWindow, showDebugWindow } from "../stores/windowStores";
    import type { Writable } from "svelte/store";

    let dragState: DragState = $state(DragState.Idle);
    let webglCanvas: { draw: (frame: Uint8Array) => void } | null = $state(null);
    let menuOpen: boolean = $state(false);

    function toggleWindow(store: Writable<boolean>) {
        store.update(v => !v);
        menuOpen = false;
    }

    const menuItems = $derived([
        { label: 'ROMs',    active: $showRomsWindow,    toggle: () => toggleWindow(showRomsWindow) },
        { label: 'Saves',   active: $showSavesWindow,   toggle: () => toggleWindow(showSavesWindow) },
        { label: 'Options', active: $showOptionsWindow, toggle: () => toggleWindow(showOptionsWindow) },
        { label: 'Debug',   active: $showDebugWindow,   toggle: () => toggleWindow(showDebugWindow) },
    ]);

    onMount(() => {
        const drawCallback = () => webglCanvas?.draw(Emulator.GetGameFrame());
        Emulator.AddPostRunCallback(drawCallback);
        return () => Emulator.RemovePostRunCallback(drawCallback);
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
        >
            <WebGLCanvas
                bind:this={webglCanvas}
                pixelSize={$playerPixelSize}
                palette={PALETTE_PRESETS[$SelectedPaletteIndex]}
            />
            {#if $showFPS}
                <div class="fps-wrapper">
                    <FpsCounter />
                </div>
            {/if}
            <button class="burger-btn" onclick={() => menuOpen = !menuOpen} aria-label="Menu">☰</button>
            {#if menuOpen}
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
<PlayerControls />

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

    .screen.drop-allowed {
        background-color: #608cb8;
    }

    .screen.drop-disallowed {
        background-color: #7a6b68;
    }

    .fps-wrapper {
        position: absolute;
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
</style>
