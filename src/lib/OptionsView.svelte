<script lang="ts">
    import {
        useBoot,
        playerPixelSize,
        showFPS,
        RemoteRomsListUri,
        ShowDebugger,
    } from "stores/optionsStore";
    import { EmulatorInitialized } from "stores/playStores";
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
