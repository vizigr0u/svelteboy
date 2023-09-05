<script lang="ts">
    import PlayerControls from "./PlayerControls.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
    import LcdCanvas from "./LcdCanvas.svelte";
    import { playerPixelSize } from "../stores/optionsStore";
    import LocalInputViewer from "./LocalInputViewer.svelte";
    import { onMount } from "svelte";
    import { DisableKeyBoardInput, EnableKeyBoardInput } from "../inputs";
    import { Emulator } from "../emulator";

    onMount(() => {
        EnableKeyBoardInput();
        return DisableKeyBoardInput;
    });
</script>

<div class="console">
    <div class="screen">
        <LcdCanvas
            updateBuffer={(_) => Emulator.GetGameFrame()}
            width={160}
            height={144}
            bind:pixelSize={$playerPixelSize}
        />
    </div>
    <span class="console-name">Svelte BOY</span>
    <LocalInputViewer />
</div>
<PlayerControls />
<FpsCounter />

<style>
    .console {
        padding-top: 1em;
        background-color: #bbb;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 1em 1em 7em 1em;
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
        padding: 2em 5em;
        background-color: #68717a;
        margin: 0.5em;
        border-radius: 1em 1em 4em 1em;
    }
</style>
