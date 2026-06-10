<script lang="ts">
    import { bulkImportFromManifest, libraryHydrated, libraryStore } from "@/stores/libraryStore";
    import {
        DismissBadgeHint,
        LibraryImportSourceUri,
        LibrarySort,
        LibrarySource,
        LibraryTypeFilterStore,
        type LibrarySortOrder,
        type LibrarySourceFilter,
        type LibraryTypeFilter,
    } from "@/stores/optionsStore";
    import { DragState, type LibraryRom } from "../types";
    import { importRomFiles, type ImportReport } from "../romImport";
    import { CartType, cartTypeFromCgbFlag } from "../cartType";
    import RomDropZone from "./RomDropZone.svelte";
    import RomList from "./RomList.svelte";
    import Icon from "./icons/Icon.svelte";

    let dragState: DragState = $state(DragState.Idle);
    let dragStatus: string = $state("");
    let progress: { done: number; total: number } | undefined = $state(undefined);
    let report: ImportReport | undefined = $state(undefined);
    let importing = $state(false);

    let fileInputEl: HTMLInputElement | undefined = $state();
    const FILE_PICKER_ACCEPT = ".gb,.gbc,.zip,application/zip,application/octet-stream";

    function openFilePicker() {
        fileInputEl?.click();
    }

    async function onFileInputChange(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const list = input.files;
        if (!list || list.length === 0) return;
        const files = Array.from(list);
        input.value = ""; // reset so same file can be re-selected
        importing = true;
        progress = { done: 0, total: files.length };
        dragStatus = `Importing ${files.length}...`;
        try {
            const r = await importRomFiles(files, (done, total) => {
                progress = { done, total };
            });
            report = r;
        } finally {
            progress = undefined;
            dragStatus = "";
            importing = false;
        }
    }

    const sortOptions: { value: LibrarySortOrder; label: string }[] = [
        { value: "lastPlayed", label: "Last played" },
        { value: "added", label: "Added (newest)" },
        { value: "name", label: "Name" },
        { value: "size", label: "Size" },
        { value: "mbc", label: "MBC type" },
    ];

    const MBC_ORDER: Record<string, number> = { 'none': 0, 'mbc1': 1, 'mbc2': 2, 'mbc3': 3, 'mbc5': 4 };
    function mbcOrder(r: LibraryRom): number {
        return r.mbcKind ? (MBC_ORDER[r.mbcKind] ?? 99) : 100;
    }

    const sourceOptions: { value: LibrarySourceFilter; label: string }[] = [
        { value: "all", label: "All" },
        { value: "local", label: "Local" },
        { value: "remote", label: "Remote" },
    ];

    const typeChips: { value: LibraryTypeFilter; label: string }[] = [
        { value: "all", label: "All" },
        { value: "gb-compat", label: "GB-compat" },
        { value: "cgb-only", label: "CGB-only" },
    ];

    let search: string = $state("");
    const SEARCH_MAX = 5;

    function passesSource(r: LibraryRom, mode: LibrarySourceFilter): boolean {
        if (mode === "local") return r.source.kind === "idb";
        if (mode === "remote") return r.source.kind !== "idb";
        return true;
    }

    function passesType(r: LibraryRom, mode: LibraryTypeFilter): boolean {
        if (mode === "all") return true;
        const t = cartTypeFromCgbFlag(r.cgbFlag);
        if (mode === "cgb-only") return t === CartType.CGB_ONLY;
        return t !== CartType.CGB_ONLY;
    }

    function passesSearch(r: LibraryRom, q: string): boolean {
        if (!q) return true;
        return r.name.toLowerCase().includes(q.toLowerCase().slice(0, SEARCH_MAX));
    }

    let sortedRoms = $derived(
        $libraryStore
            .filter(
                (r) =>
                    passesSource(r, $LibrarySource) &&
                    passesType(r, $LibraryTypeFilterStore) &&
                    passesSearch(r, search),
            )
            .sort((a, b) => {
                if ($LibrarySort === "name") return a.name.localeCompare(b.name);
                if ($LibrarySort === "lastPlayed")
                    return (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0);
                if ($LibrarySort === "size")
                    return (b.fileSize ?? 0) - (a.fileSize ?? 0);
                if ($LibrarySort === "mbc") {
                    const d = mbcOrder(a) - mbcOrder(b);
                    return d !== 0 ? d : a.name.localeCompare(b.name);
                }
                return (b.addedAt ?? 0) - (a.addedAt ?? 0);
            }),
    );
    let isEmpty = $derived($libraryHydrated && $libraryStore.length === 0);
    let hasOnlyRemote = $derived(
        $libraryStore.length > 0 &&
        $libraryStore.every((r) => r.source.kind !== "idb"),
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
                        {#if report.errors.length <= 2}
                            : {report.errors.map((e) => (e.name + ': ' + e.reason)).join(", ")}
                        {/if}
                    </div>
                {/if}
                {#if report.skippedSav.length > 0}
                    <div class="line muted">
                        Skipped {report.skippedSav.length} .sav files (saves not persistent)
                    </div>
                {/if}
            </div>
        {/if}
        {#if isEmpty}
            <div class="empty-library">
                <Icon name="cloud-arrow-down" />
                <h3>Your library is empty</h3>
                <p>Drop a <code>.gb</code> or <code>.gbc</code> ROM file here, or pick one from your device.<br />Zipped roms supported.</p>
                <div class="empty-cta-row">
                    <button class="browse-btn primary" onclick={openFilePicker} disabled={importing}>
                        <Icon name="cloud-arrow-up" /> Choose ROM file…
                    </button>
                    <button class="browse-btn" onclick={addSpecialSource} disabled={importing}>
                        Browse homebrews…
                    </button>
                </div>
            </div>
        {/if}
        {#if !isEmpty && !$DismissBadgeHint && hasOnlyRemote}
            <div class="badge-hint">
                <span>
                    Remote ROMs are dimmed. Click <em>Save locally</em> in their details to install them.
                </span>
                <button
                    aria-label="Dismiss hint"
                    onclick={() => DismissBadgeHint.set(true)}
                ><Icon name="xmark" /></button>
            </div>
        {/if}
        <div class="library-controls">
            <button
                type="button"
                class="add-rom-btn"
                title="Add ROM from your device"
                onclick={openFilePicker}
                disabled={importing}
            >
                <Icon name="cloud-arrow-up" /> Add ROM
            </button>
            <button
                type="button"
                class="add-source"
                title="Add special source URL"
                onclick={addSpecialSource}
                disabled={importing}
            >
                +
            </button>
            <div class="type-chips" role="radiogroup" aria-label="Cart type filter">
                {#each typeChips as chip}
                    <button
                        type="button"
                        class="chip"
                        class:active={$LibraryTypeFilterStore === chip.value}
                        onclick={() => LibraryTypeFilterStore.set(chip.value)}
                        aria-pressed={$LibraryTypeFilterStore === chip.value}
                    >{chip.label}</button>
                {/each}
            </div>
            <label class="search-label">
                <Icon name="magnifying-glass" />
                <input
                    type="search"
                    placeholder="Search"
                    bind:value={search}
                    aria-label="Search library"
                />
            </label>
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

<input
    bind:this={fileInputEl}
    type="file"
    accept={FILE_PICKER_ACCEPT}
    multiple
    class="visually-hidden"
    onchange={onFileInputChange}
    aria-hidden="true"
    tabindex="-1"
/>

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
        flex-wrap: wrap;
    }
    .type-chips {
        display: inline-flex;
        gap: 0.3em;
    }
    .chip {
        padding: 0.15em 0.6em;
        border: 1px solid #45475a;
        background: #313244;
        color: #cdd6f4;
        border-radius: 1em;
        font-size: 0.78em;
        cursor: pointer;
    }
    .chip.active {
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
        border-color: var(--highlight-color, #89b4fa);
    }
    .search-label {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
    }
    .search-label input {
        padding: 0.15em 0.4em;
        font-size: 0.85em;
        max-width: 9em;
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

    .empty-library {
        text-align: center;
        padding: 2em 1em;
        color: #cdd6f4;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5em;
    }
    .empty-library :global(.icon) {
        font-size: 2.5em;
        color: var(--highlight-color, #89b4fa);
        opacity: 0.7;
    }
    .empty-library h3 {
        margin: 0;
        font-size: 1.1em;
    }
    .empty-library p {
        margin: 0;
        color: #aaa;
        font-size: 0.9em;
    }
    .empty-library code {
        background: #313244;
        padding: 0.05em 0.3em;
        border-radius: 0.2em;
        font-size: 0.9em;
    }
    .browse-btn {
        padding: 0.45em 1.1em;
        background: rgba(255,255,255,0.06);
        color: #cdd6f4;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 999px;
        cursor: pointer;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 0.35em;
        min-height: 44px;
    }
    .browse-btn:hover:not(:disabled) {
        background: rgba(255,255,255,0.1);
    }
    .browse-btn.primary {
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
        border-color: var(--highlight-color, #89b4fa);
    }
    .browse-btn.primary:hover:not(:disabled) {
        filter: brightness(1.08);
        background: var(--highlight-color, #89b4fa);
    }
    .browse-btn:disabled {
        opacity: 0.5;
        cursor: wait;
    }
    .empty-cta-row {
        display: flex;
        gap: 0.6em;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 0.4em;
    }
    .add-rom-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
        padding: 0.3em 0.7em;
        background: rgba(255,255,255,0.06);
        color: #cdd6f4;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 0.3em;
        cursor: pointer;
        font-size: 0.85em;
    }
    .add-rom-btn:hover:not(:disabled) {
        background: rgba(255,255,255,0.12);
    }
    .add-rom-btn:disabled {
        opacity: 0.5;
        cursor: wait;
    }
    .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
    }

    .badge-hint {
        display: flex;
        align-items: center;
        gap: 0.6em;
        background: #313244;
        border-left: 3px solid var(--highlight-color, #89b4fa);
        padding: 0.4em 0.6em;
        margin: 0.3em 0;
        font-size: 0.85em;
        color: #cdd6f4;
    }
    .badge-hint span { flex: 1; }
    .badge-hint button {
        background: transparent;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 0.2em;
    }
    .badge-hint button:hover {
        color: #f38ba8;
    }
</style>
