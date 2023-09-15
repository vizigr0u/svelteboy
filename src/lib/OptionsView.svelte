<script lang="ts">
    import {
        useBoot,
        playerPixelSize,
        showFPS,
        RemoteRomsListUri,
        ShowDebugger,
        EmulatorSpeed,
        AudioBufferSize,
        AudioMasterVolume,
    } from "stores/optionsStore";
    import { EmulatorInitialized } from "stores/playStores";

    const validAudioBufferSizes = [64, 128, 256, 512, 1024, 2048];
</script>

<div class="options-view debug-tool-container">
    <h3>Options</h3>
    <div class="options">
        <label for="pixelSize"> Pixel size: </label>
        <input
            id="pixelSize"
            type="number"
            min="1"
            max="10"
            bind:value={$playerPixelSize}
        />

        <label for="remoteRomsUri">Remote Roms List: </label>
        <input id="remoteRomsUri" type="text" bind:value={$RemoteRomsListUri} />

        <label for="showdebugger"> Show Debugger: </label>
        <input id="showdebugger" type="checkbox" bind:checked={$ShowDebugger} />

        <label for="showfps"> Display FPS: </label>
        <input id="showfps" type="checkbox" bind:checked={$showFPS} />

        <label for="useBoot"
            >Use Boot Rom{$EmulatorInitialized ? " (on next run)" : ""}:</label
        >
        <input id="useBoot" type="checkbox" bind:checked={$useBoot} disabled />
        <span>Todo: </span><span>Select boot rom</span>

        <label for="emulatorspeed">Emulator Speed</label>
        <input
            id="emulatorspeed"
            type="number"
            min="0.01"
            max="6"
            step="0.1"
            bind:value={$EmulatorSpeed}
        />

        <label for="bufferaudiosize">Audio Buffer size:</label>
        <select id="bufferaudiosize" bind:value={$AudioBufferSize}>
            {#each validAudioBufferSizes as size}
                <option value={size}>{size}</option>
            {/each}
        </select>

        <label for="mastervolume">Master Volume</label>
        <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={$AudioMasterVolume}
        />
    </div>
</div>

<style>
    .options {
        display: grid;
        grid-template-columns: 13em auto;
    }
    .options input[type="checkbox"] {
        margin-right: auto;
    }
</style>
