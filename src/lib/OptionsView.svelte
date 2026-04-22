<script lang="ts">
    import {
        useBoot,
        playerPixelSize,
        showFPS,
        RemoteRomsListUri,
        EmulatorSpeed,
        // AudioBufferSize,
        AudioMasterVolume,
        HideKeyboardWarning,
    } from "stores/optionsStore";
    import { showDebugWindow } from "../stores/windowStores";
    import { EmulatorInitialized } from "stores/playStores";
    import ControlsView from "./ControlsView.svelte";
    import PalettePicker from "./PalettePicker.svelte";

    const validAudioBufferSizes = [64, 128, 256, 512, 1024, 2048];

    let advancedOpen = $state(false);

    function clearLocalStorage() {
        localStorage.clear();
        location.reload();
    }

    function resetKeybindingDisclaimer() {
        HideKeyboardWarning.set(false);
    }
</script>

<div class="options-view debug-tool-container">
    <h3>Options</h3>
    <h4>Display</h4>
    <div class="options">
        <label for="pixelSize">Pixel size:</label>
        <input
            id="pixelSize"
            type="number"
            min="1"
            max="10"
            bind:value={$playerPixelSize}
        />

        <span class="option-label">Palette:</span>
        <PalettePicker />

        <label for="showfps">Display FPS:</label>
        <input id="showfps" type="checkbox" bind:checked={$showFPS} />
    </div>

    <h4>Emulation</h4>
    <div class="options">
        <label for="emulatorspeed">Speed:</label>
        <input
            id="emulatorspeed"
            type="number"
            min="0.01"
            max="6"
            step="0.1"
            bind:value={$EmulatorSpeed}
        />

        <label for="useBoot"
            >Use Boot Rom{$EmulatorInitialized ? " (on next run)" : ""}:</label
        >
        <input id="useBoot" type="checkbox" bind:checked={$useBoot} disabled />
        <span>Todo: </span><span>Select boot rom</span>
    </div>

    <h4>Audio</h4>
    <div class="options">
        <!-- <label for="bufferaudiosize">Audio Buffer size:</label>
        <select id="bufferaudiosize" bind:value={$AudioBufferSize}>
            {#each validAudioBufferSizes as size}
                <option value={size}>{size}</option>
            {/each}
        </select> -->

        <label for="mastervolume">Master Volume:</label>
        <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            bind:value={$AudioMasterVolume}
        />
    </div>

    <h4>Interface</h4>
    <div class="options">
        <label for="showdebugger">Show Debugger:</label>
        <input id="showdebugger" type="checkbox" bind:checked={$showDebugWindow} />

        <label for="remoteRomsUri">Remote Roms List:</label>
        <input id="remoteRomsUri" type="text" bind:value={$RemoteRomsListUri} />
    </div>

    <ControlsView />

    <details bind:open={advancedOpen}>
        <summary><h3>Advanced</h3></summary>
        <div class="advanced">
            <button onclick={resetKeybindingDisclaimer}>Reset keybinding disclaimer</button>
            <button class="danger" onclick={clearLocalStorage}>Clear all local storage</button>
        </div>
    </details>
</div>

<style>
    h4 {
        margin: 0.6em 0 0.2em;
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #888;
    }
    .options {
        display: grid;
        grid-template-columns: 13em minmax(0, 1fr);
    }
    .options input[type="checkbox"] {
        margin-right: auto;
    }
    .option-label {
        display: flex;
        align-items: center;
    }

    details summary h3 {
        display: inline;
        cursor: pointer;
    }
    .advanced {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        padding: 0.5em 0;
    }
    .advanced button {
        width: fit-content;
    }
    .danger {
        color: #c00;
    }
</style>
