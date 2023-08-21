<script lang="ts">
    import VirtualList from "svelte-virtual-list-ce";
    import { DebugLines, ProgramRunning } from "../../stores/debugStores";
    import { loadedCartridge } from "../../stores/romStores";

    let maxLines = 2000;

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

    function onDownloadClick() {
        const link = document.createElement("a");
        const file = new Blob(
            $DebugLines.map((s) => s + "\n"),
            { type: "text/plain" }
        );
        link.href = URL.createObjectURL(file);
        link.download = getLogFilename();
        link.click();
        URL.revokeObjectURL(link.href);
    }
</script>

<div class="log-section debug-tool-container">
    <h4 class="log-title">Log</h4>
    <div class="log-section-controls">
        {#if $DebugLines.length > maxLines}
            <span class="logview-hint"
                >showing {maxLines}/{$DebugLines.length} lines</span
            >
        {/if}
        <button
            on:click={onClearClick}
            disabled={$DebugLines.length == 0}
            class="log-clear-button">Clear</button
        >
        <button
            on:click={onDownloadClick}
            disabled={$DebugLines.length == 0 || $ProgramRunning}
            class="log-clear-button">Download</button
        >
    </div>
    <div class="log-container">
        <VirtualList items={$DebugLines.slice(-maxLines)} let:item>
            <span>{item}</span>
        </VirtualList>
    </div>
</div>

<style>
    .log-section {
        min-height: 5em;
        position: relative;
    }
    .log-title {
        font-weight: 600;
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
        text-align: left;
        height: 25em;
        font-size: small;
        font-family: "Courier New", Courier, monospace;
    }
</style>
