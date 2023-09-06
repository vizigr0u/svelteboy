<script lang="ts">
    import { fetchLogs } from "../../debug";
    import { Debug } from "../../emulator";
    import {
        DebugLines,
        MutedCategories,
        Verbose,
    } from "../../stores/debugStores";
    import { EmulatorBusy } from "../../stores/playStores";
    import { loadedCartridge } from "../../stores/romStores";
    import { humanReadableNumber } from "../../utils";

    let maxLines = 500;

    const LogCategories = [
        "EMU",
        "CPU",
        "PPU",
        "MEM",
        "AUD",
        "DBG",
        "IO:",
        "SRL",
        "ROM",
        "MBC",
        "SAV",
    ];

    function onClearClick() {
        $DebugLines = [];
    }

    function getCurrentDateTime(): string {
        const now = new Date();

        const year = now.getFullYear();

        // Months in JavaScript are 0-based, so we add 1 to get the correct month.
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const day = now.getDate().toString().padStart(2, "0");
        const hour = now.getHours().toString().padStart(2, "0");
        const minute = now.getMinutes().toString().padStart(2, "0");
        const second = now.getSeconds().toString().padStart(2, "0");

        return `${year}-${month}-${day}-${hour}${minute}${second}`;
    }

    function getLogFilename(): string {
        return `${getCurrentDateTime()}_${$loadedCartridge?.filename}.txt`;
    }

    function filterLog(log: string[], mutedCategories: string[]): string[] {
        return log.filter((m) => !mutedCategories.includes(m.slice(0, 3)));
    }

    function downloadLog(mutedCategories: string[]) {
        const link = document.createElement("a");
        const file = new Blob(
            filterLog($DebugLines, mutedCategories).map((s) => s + "\n"),
            { type: "text/plain" }
        );
        link.href = URL.createObjectURL(file);
        link.download = getLogFilename();
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function toggleCategory(cat: string) {
        MutedCategories.update((cats) => {
            if (cats.includes(cat)) cats.splice(cats.indexOf(cat), 1);
            else cats.push(cat);
            return cats;
        });
    }
</script>

<div class="log-section debug-tool-container">
    <h3>Logs</h3>
    <div class="log-section-controls">
        <label
            >Verbose
            <input
                type="number"
                class="verbose-input"
                bind:value={$Verbose}
                on:change={() => Debug.SetVerbose($Verbose)}
                min="0"
                max="10"
            />
        </label>
        <div class="log-category-dropdown">
            <button class="log-category-toggle">Filter... </button>
            <div class="log-category-dropdown-content">
                {#each LogCategories as cat}
                    <button
                        class="category-option"
                        on:click={() => toggleCategory(cat)}
                        >{$MutedCategories.includes(cat) ? "\u2610" : "\u2611"}
                        {cat}</button
                    >
                {/each}
            </div>
        </div>
        {#if $DebugLines && $DebugLines.length > maxLines}
            <span class="logview-hint"
                >showing {maxLines}/{humanReadableNumber($DebugLines.length)} lines</span
            >
        {/if}
        <button
            on:click={onClearClick}
            disabled={!$DebugLines || $DebugLines.length == 0}
            class="log-clear-button">Clear</button
        >
        <button
            on:click={fetchLogs}
            disabled={$EmulatorBusy}
            class="log-clear-button">Fetch now</button
        >
        <button
            on:click={() => downloadLog([])}
            disabled={!$DebugLines || $DebugLines.length == 0 || $EmulatorBusy}
            class="log-clear-button">Download</button
        >
        <button
            on:click={() => downloadLog($MutedCategories)}
            disabled={!$DebugLines || $DebugLines.length == 0 || $EmulatorBusy}
            class="log-clear-button">Download Fitlered</button
        >
    </div>
    <div class="log-container">
        {#each filterLog($DebugLines, $MutedCategories).slice(-maxLines) as item}
            <span>{item}</span>
        {/each}
    </div>
</div>

<style>
    .log-category-dropdown {
        position: relative;
        display: inline-block;
    }
    .log-category-dropdown:hover .log-category-dropdown-content {
        display: block;
    }
    .log-category-dropdown-content {
        display: none;
        position: absolute;
        box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
        background-color: #1a1a1a;
        z-index: 1;
    }
    .category-option {
        min-width: 5em;
        text-align: left;
        text-decoration: none;
        display: block;
        text-transform: capitalize;
    }
    .category-option:hover {
        background-color: #333;
    }
    .log-section {
        min-height: 5em;
        position: relative;
    }
    .log-section-controls {
        display: flex;
        justify-content: space-around;
        align-items: center;
    }
    .logview-hint {
        font-size: small;
    }

    .log-container {
        display: flex;
        flex-direction: column;
        text-align: left;
        height: 25em;
        overflow-y: auto;
        font-size: small;
        font-family: "Courier New", Courier, monospace;
    }

    .verbose-input {
        max-width: 3em;
    }
</style>
