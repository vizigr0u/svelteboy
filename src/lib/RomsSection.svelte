<script lang="ts">
    import { bulkImportFromManifest, libraryStore } from "@/stores/libraryStore";
    import {
        LibraryImportSourceUri,
        LibrarySort,
        LibrarySource,
        type LibrarySortOrder,
        type LibrarySourceFilter,
    } from "@/stores/optionsStore";
    import { DragState } from "../types";
    import type { ImportReport } from "../romImport";
    import RomDropZone from "./RomDropZone.svelte";
    import RomList from "./RomList.svelte";

    let dragState: DragState = $state(DragState.Idle);
    let dragStatus: string = $state("");
    let progress: { done: number; total: number } | undefined = $state(undefined);
    let report: ImportReport | undefined = $state(undefined);
    let importing = $state(false);

    const sortOptions: { value: LibrarySortOrder; label: string }[] = [
        { value: "lastPlayed", label: "Last played" },
        { value: "added", label: "Added (newest)" },
        { value: "name", label: "Name" },
    ];

    const sourceOptions: { value: LibrarySourceFilter; label: string }[] = [
        { value: "all", label: "All" },
        { value: "local", label: "Local" },
        { value: "remote", label: "Remote" },
    ];

    let sortedRoms = $derived(
        $libraryStore
            .filter((r) => {
                if ($LibrarySource === "local") return r.source.kind === "idb";
                if ($LibrarySource === "remote") return r.source.kind !== "idb";
                return true;
            })
            .sort((a, b) => {
                if ($LibrarySort === "name") return a.name.localeCompare(b.name);
                if ($LibrarySort === "lastPlayed")
                    return (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0);
                return (b.addedAt ?? 0) - (a.addedAt ?? 0);
            }),
    );

    function onImportComplete(r: ImportReport) {
        report = r;
    }

    function dismissReport() {
        report = undefined;
    }

    async function addSpecialSource() {
        const input = prompt(
            "Special source URL (manifest JSON):",
            $LibraryImportSourceUri,
        );
        if (!input) return;
        const uri = input.trim();
        if (!uri.startsWith("http")) {
            dragStatus = "Provide an http(s) URL";
            return;
        }
        $LibraryImportSourceUri = uri;
        importing = true;
        dragStatus = "Importing...";
        try {
            const { added, skipped } = await bulkImportFromManifest(uri);
            dragStatus = `Imported ${added}, skipped ${skipped}`;
        } catch (e) {
            dragStatus = `Error: ${(e as Error).message}`;
        } finally {
            importing = false;
        }
    }
</script>

<RomDropZone bind:dragState bind:dragStatus bind:progress {onImportComplete}>
    <div
        class="dropzone-hint"
        class:drop-allowed={dragState == DragState.Accept}
        class:drop-disallowed={dragState == DragState.Reject}
    >
        <p>
            Drop your rom files here
            <span>{dragStatus}</span>
        </p>
        {#if progress && progress.total > 4}
            <progress value={progress.done} max={progress.total}></progress>
        {/if}
        {#if report}
            <div class="import-report">
                <button
                    type="button"
                    class="dismiss"
                    title="Dismiss"
                    onclick={dismissReport}>×</button
                >
                {#if report.added.length > 0}
                    <div class="line ok">Added {report.added.length} roms</div>
                {/if}
                {#if report.duplicates.length > 0}
                    <div class="line warn">
                        {report.duplicates.length} already in library (check console)
                    </div>
                {/if}
                {#if report.errors.length > 0}
                    <div class="line err">
                        {report.errors.length} imports failed (check console)
                    </div>
                {/if}
                {#if report.skippedSav.length > 0}
                    <div class="line muted">
                        Skipped {report.skippedSav.length} .sav files (saves not persistent)
                    </div>
                {/if}
            </div>
        {/if}
        <div class="library-controls">
            <button
                type="button"
                class="add-source"
                title="Add special source URL"
                onclick={addSpecialSource}
                disabled={importing}
            >
                +
            </button>
            <label>
                Source:
                <select bind:value={$LibrarySource}>
                    {#each sourceOptions as opt}
                        <option value={opt.value}>{opt.label}</option>
                    {/each}
                </select>
            </label>
            <label>
                Sort:
                <select bind:value={$LibrarySort}>
                    {#each sortOptions as opt}
                        <option value={opt.value}>{opt.label}</option>
                    {/each}
                </select>
            </label>
        </div>
        <RomList title="Library" roms={sortedRoms} />
    </div>
</RomDropZone>

<style>
    .dropzone-hint {
        margin: 0.5em;
        padding: 0.5em;
        background-color: var(--subsection-bg-color);
        border: 2px solid #111;
        display: flex;
        flex-direction: column;
    }

    .dropzone-hint.drop-allowed {
        border-color: greenyellow;
    }

    .dropzone-hint.drop-disallowed {
        border-color: red;
    }

    .library-controls {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.5em;
        padding: 0.3em 0.5em;
    }
    .add-source {
        margin-right: auto;
        width: 1.8em;
        height: 1.8em;
        font-size: 1em;
        line-height: 1;
        cursor: pointer;
    }
    .add-source:disabled {
        cursor: wait;
    }

    progress {
        width: 100%;
        margin: 0.3em 0;
    }

    .import-report {
        position: relative;
        margin: 0.3em 0;
        padding: 0.4em 1.6em 0.4em 0.5em;
        background: rgba(0, 0, 0, 0.25);
        border-left: 3px solid #555;
        font-size: 0.9em;
    }
    .import-report .line {
        line-height: 1.3;
    }
    .import-report .ok {
        color: greenyellow;
    }
    .import-report .warn {
        color: goldenrod;
    }
    .import-report .err {
        color: tomato;
    }
    .import-report .muted {
        color: #888;
    }
    .import-report .dismiss {
        position: absolute;
        top: 0.1em;
        right: 0.2em;
        background: transparent;
        border: none;
        color: inherit;
        font-size: 1.1em;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.2em;
    }
</style>
