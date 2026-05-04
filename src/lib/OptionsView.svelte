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
        CgbColor,
        GhostingStrength,
        ScreenshotSize,
        PixelPerfect,
        HapticsEnabled,
        WakeLockEnabled,
        OrientationLockEnabled,
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
    <h4>Emulation</h4>
    <div class="options">
        <label for="defaultRenderMode">Default emulator mode:</label>
        <select id="defaultRenderMode" bind:value={$DefaultRenderMode}>
            <option value="auto">Auto (per cart)</option>
            <option value="force-gb">Force GB</option>
            <option value="force-cgb">Force CGB</option>
        </select>

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

        <label for="showfps">Display FPS:</label>
        <input id="showfps" type="checkbox" bind:checked={$showFPS} />

        <label for="showframetime">Frametime histogram:</label>
        <input id="showframetime" type="checkbox" bind:checked={$showFrametimeHistogram} />

        <label for="pixelPerfect">Pixel-perfect scale:</label>
        <input id="pixelPerfect" type="checkbox" bind:checked={$PixelPerfect} />

        <label for="ghosting">Ghosting / motion blur:</label>
        <input
            id="ghosting"
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            bind:value={$GhostingStrength}
        />

        <label for="screenshotSize">Screenshot size:</label>
        <select id="screenshotSize" bind:value={$ScreenshotSize}>
            <option value="gb">GB native (160×144, raw)</option>
            <option value="canvas">Canvas size (with shaders)</option>
        </select>
    </div>

    <h4>GB mode (DMG)</h4>
    <div class="options">
        <span class="option-label">Palette:</span>
        <DisabledTooltip
            disabled={cgbActive}
            message="GB palette is unused in CGB mode."
        >
            <PalettePicker />
        </DisabledTooltip>
    </div>

    <h4>CGB mode</h4>
    <div class="options">
        <span class="option-label">Color treatment:</span>
        <DisabledTooltip
            disabled={!cgbActive}
            message="CGB color treatment is unused in GB mode."
        >
            <select id="cgbColor" bind:value={$CgbColor}>
                <option value="none">None</option>
                <option value="lut">Original colors (Gambatte LUT)</option>
                <option value="subpixel">Original subpixels (LCD effect)</option>
            </select>
        </DisabledTooltip>
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

    <h4>Mobile</h4>
    <div class="options">
        <label for="haptics">Haptic feedback on tap:</label>
        <input id="haptics" type="checkbox" bind:checked={$HapticsEnabled} />

        <label for="wakelock">Keep screen awake while playing:</label>
        <input id="wakelock" type="checkbox" bind:checked={$WakeLockEnabled} />

        <label for="orientlock">Lock orientation in fullscreen:</label>
        <input id="orientlock" type="checkbox" bind:checked={$OrientationLockEnabled} />
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
