<script lang="ts">
    import {
        useBoot,
        frameDelay,
        playerPixelSize,
    } from "../stores/optionsStore";
    import { DebugSessionStarted } from "../stores/debugStores";
</script>

<div class="options-view debug-tool-container">
    <h3>Options</h3>
    <div class="options">
        <label for="useBoot">Use Boot</label>
        <input
            id="useBoot"
            type="checkbox"
            bind:checked={$useBoot}
            disabled={$DebugSessionStarted}
        />

        <label for="frameDelay">Frame delay</label>
        <input
            id="frameDelay"
            type="number"
            bind:value={$frameDelay}
            min="0"
            max="100"
        />

        <label for="pixelSize"> Pixel size: </label>
        <input
            id="pixelSize"
            type="number"
            min="1"
            max="10"
            bind:value={$playerPixelSize}
        />
    </div>
</div>

<style>
    .options {
        display: grid;
        grid-template-columns: 10em auto;
    }
    .options input[type="checkbox"] {
        margin-right: auto;
    }
</style>
