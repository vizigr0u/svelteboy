<script lang="ts">
    import PlayerControls from "./PlayerControls.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
    import { playerPixelSize, showFPS } from "stores/optionsStore";
    import LocalInputViewer from "./LocalInputViewer.svelte";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { Emulator } from "../emulator";
    import RomDropZone from "./RomDropZone.svelte";
    import { DragState } from "../types";
    import PlayCanvas from "./PlayCanvas.svelte";

    let dragState: DragState;
    let drawToCanvas;

    Emulator.AddPostRunCallback(() => {
        drawToCanvas(Emulator.GetGameFrame());
    });
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
    class="console"
    role="main"
    tabindex="0"
    on:keydown={gameInputKeydownHandler}
    on:keyup={gameInputKeyupHandler}
>
    <RomDropZone onRomReceived={Emulator.PlayRom} bind:dragState>
        <div
            class="screen"
            class:drop-allowed={dragState == DragState.Accept}
            class:drop-disallowed={dragState == DragState.Reject}
        >
            <PlayCanvas
                width={160}
                height={144}
                bind:draw={drawToCanvas}
                pixelSize={$playerPixelSize}
            />
            {#if $showFPS}
                <div class="fps-wrapper">
                    <FpsCounter />
                </div>
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
</style>
