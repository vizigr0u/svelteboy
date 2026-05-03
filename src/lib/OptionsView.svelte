<script lang="ts">
    import {
        playerPixelSize,
        showFPS,
        showFrametimeHistogram,
        AutoSaveUriRoms,
        RegularSpeed,
        BurstSpeed,
        MuteOnFastForward,
        PauseOnVisibilityLost,
        // AudioBufferSize,
        AudioMasterVolume,
        AudioResampleMode,
        DefaultRenderMode,
    } from "stores/optionsStore";
    import { clearAllStorage } from "../stores/idbStore";
    import PalettePicker from "./PalettePicker.svelte";
    import DisabledTooltip from "./DisabledTooltip.svelte";
    import { isCgbMode } from "../emulator/wasmBridge";
    import { EmulatorInitialized, GameFrames } from "stores/playStores";

    let advancedOpen = $state(false);
    // Re-evaluate when frames advance or emulator re-initializes.
    let cgbActive = $derived.by(() => {
        $EmulatorInitialized;
        $GameFrames;
        return isCgbMode();
    });

    async function clearAll() {
        const ok = confirm(
            "This will permanently delete ALL stored ROMs, save games, and preferences. Continue?",
        );
        if (!ok) return;
        await clearAllStorage();
        location.reload();
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

        <span class="option-label">GB Palette:</span>
        <DisabledTooltip
            disabled={cgbActive}
            message="GB palette is unused in CGB mode."
        >
            <PalettePicker />
        </DisabledTooltip>

        <label for="defaultRenderMode">Default render mode:</label>
        <select id="defaultRenderMode" bind:value={$DefaultRenderMode}>
            <option value="auto">Auto (per cart)</option>
            <option value="force-gb">Force GB</option>
            <option value="force-cgb">Force CGB</option>
        </select>

        <label for="showfps">Display FPS:</label>
        <input id="showfps" type="checkbox" bind:checked={$showFPS} />

        <label for="showframetime">Frametime histogram:</label>
        <input id="showframetime" type="checkbox" bind:checked={$showFrametimeHistogram} />
    </div>

    <h4>Emulation</h4>
    <div class="options">
        <label for="regularspeed">Regular speed:</label>
        <input
            id="regularspeed"
            type="number"
            min="0.01"
            max="100"
            step="0.1"
            bind:value={$RegularSpeed}
        />

        <label for="burstspeed">Burst speed (hold Space):</label>
        <input
            id="burstspeed"
            type="number"
            min="0.01"
            max="100"
            step="0.1"
            bind:value={$BurstSpeed}
        />

        <label for="muteonfastforward">Mute sound while burst active:</label>
        <input
            id="muteonfastforward"
            type="checkbox"
            bind:checked={$MuteOnFastForward}
        />

        <label for="pauseOnVisibilityLost">Pause when tab hidden:</label>
        <input
            id="pauseOnVisibilityLost"
            type="checkbox"
            bind:checked={$PauseOnVisibilityLost}
        />
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

        <label for="resamplemode">Resample mode:</label>
        <select id="resamplemode" bind:value={$AudioResampleMode}>
            <option value="apu">APU-side (clean anti-alias)</option>
            <option value="js">JS-side (linear interp)</option>
        </select>
    </div>

    <h4>Library</h4>
    <div class="options">
        <label for="autoSaveUri">Auto-save URI ROMs after first play:</label>
        <input
            id="autoSaveUri"
            type="checkbox"
            bind:checked={$AutoSaveUriRoms}
        />
    </div>

    <details bind:open={advancedOpen}>
        <summary><h3>Advanced</h3></summary>
        <div class="advanced">
            <button class="danger" onclick={clearAll}>Wipe all ROMs &amp; preferences</button>
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
