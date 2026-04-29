<script lang="ts">
    import { libraryStore } from "@/stores/libraryStore";
    import { LibrarySort, type LibrarySortOrder } from "@/stores/optionsStore";
    import { DragState } from "../types";
    import RomDropZone from "./RomDropZone.svelte";
    import RomList from "./RomList.svelte";

    let dragState: DragState = $state(DragState.Idle);
    let dragStatus: string = $state("");

    const sortOptions: { value: LibrarySortOrder; label: string }[] = [
        { value: "added", label: "Added (newest)" },
        { value: "name", label: "Name" },
    ];

    let sortedRoms = $derived(
        [...$libraryStore].sort((a, b) => {
            if ($LibrarySort === "name") return a.name.localeCompare(b.name);
            return (b.addedAt ?? 0) - (a.addedAt ?? 0);
        }),
    );
</script>

<RomDropZone bind:dragState bind:dragStatus>
    <div
        class="dropzone-hint"
        class:drop-allowed={dragState == DragState.Accept}
        class:drop-disallowed={dragState == DragState.Reject}
    >
        <p>
            Drop your rom files here
            <span>{dragStatus}</span>
        </p>
        <div class="library-controls">
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
        gap: 0.5em;
        padding: 0.3em 0.5em;
    }
</style>
