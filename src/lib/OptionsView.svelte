<script lang="ts">
    import {
        useBoot,
        playerPixelSize,
        showFPS,
        showFrametimeHistogram,
        LibraryImportSourceUri,
        AutoSaveUriRoms,
        EmulatorSpeed,
        HoldSpaceForSpeed,
        MuteOnFastForward,
        PauseOnVisibilityLost,
        // AudioBufferSize,
        AudioMasterVolume,
        HideKeyboardWarning,
    } from "stores/optionsStore";
    import { EmulatorInitialized } from "stores/playStores";
    import { clearAllStorage } from "../stores/idbStore";
    import { bulkImportFromManifest } from "stores/libraryStore";
    import ControlsView from "./ControlsView.svelte";
    import PalettePicker from "./PalettePicker.svelte";

    let advancedOpen = $state(false);
    let importing = $state(false);
    let importStatus = $state("");

    async function clearAll() {
        const ok = confirm(
            "This will permanently delete ALL stored ROMs, save games, and preferences. Continue?",
        );
        if (!ok) return;
        await clearAllStorage();
        location.reload();
    }

    function resetKeybindingDisclaimer() {
        HideKeyboardWarning.set(false);
    }

    async function runImport() {
        const uri = $LibraryImportSourceUri;
        if (!uri || !uri.startsWith("http")) {
            importStatus = "Provide an http(s) URL";
            return;
        }
        importing = true;
        importStatus = "Importing...";
        try {
            const { added, skipped } = await bulkImportFromManifest(uri);
            importStatus = `Imported ${added}, skipped ${skipped}`;
        } catch (e) {
            importStatus = `Error: ${(e as Error).message}`;
        } finally {
            importing = false;
        }
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

        <label for="showframetime">Frametime histogram:</label>
        <input id="showframetime" type="checkbox" bind:checked={$showFrametimeHistogram} />
    </div>

    <h4>Emulation</h4>
    <div class="options">
        <label for="emulatorspeed">Speed:</label>
        <input
            id="emulatorspeed"
            type="number"
            min="0.01"
            max="100"
            step="0.1"
            bind:value={$EmulatorSpeed}
        />

        <label for="holdspaceforspeed">Hold Space for speed (else always on):</label>
        <input
            id="holdspaceforspeed"
            type="checkbox"
            bind:checked={$HoldSpaceForSpeed}
        />

        <label for="muteonfastforward">Mute sound while speed on:</label>
        <input
            id="muteonfastforward"
            type="checkbox"
            bind:checked={$MuteOnFastForward}
        />

        <label for="useBoot"
            >Use Boot Rom{$EmulatorInitialized ? " (on next run)" : ""}:</label
        >
        <input id="useBoot" type="checkbox" bind:checked={$useBoot} disabled />
        <span>Todo: </span><span>Select boot rom</span>

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
    </div>

    <h4>Library</h4>
    <div class="options">
        <label for="libImportUri">Import source URL:</label>
        <input
            id="libImportUri"
            type="text"
            bind:value={$LibraryImportSourceUri}
        />

        <span class="option-label"></span>
        <div class="lib-import-row">
            <button onclick={runImport} disabled={importing}>
                {importing ? "Importing..." : "Import"}
            </button>
            <span class="lib-import-status">{importStatus}</span>
        </div>

        <label for="autoSaveUri">Auto-save URI ROMs after first play:</label>
        <input
            id="autoSaveUri"
            type="checkbox"
            bind:checked={$AutoSaveUriRoms}
        />
    </div>

    <ControlsView />

    <details bind:open={advancedOpen}>
        <summary><h3>Advanced</h3></summary>
        <div class="advanced">
            <button onclick={resetKeybindingDisclaimer}>Reset keybinding disclaimer</button>
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
    .lib-import-row {
        display: flex;
        align-items: center;
        gap: 0.5em;
    }
    .lib-import-status {
        font-size: 0.9em;
        color: #aaa;
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
