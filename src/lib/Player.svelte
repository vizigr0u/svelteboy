<script lang="ts">
    import PlayerControls from "./PlayerControls.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
    import LcdCanvas from "./LcdCanvas.svelte";
    import { playerPixelSize, showFPS } from "../stores/optionsStore";
    import LocalInputViewer from "./LocalInputViewer.svelte";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { Emulator } from "../emulator";
    import RomDropZone from "./RomDropZone.svelte";
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
    <RomDropZone onRomReceived={Emulator.PlayRom}>
        <div class="screen">
            <LcdCanvas
                updateBuffer={(_) => Emulator.GetGameFrame()}
                width={160}
                height={144}
                bind:pixelSize={$playerPixelSize}
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

    .fps-wrapper {
        position: absolute;
    }
</style>
