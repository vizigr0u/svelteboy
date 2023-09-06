<script lang="ts">
    import type { SaveGameData } from "../types";
    import { SaveGames } from "../stores/playStores";
    import { Emulator } from "../emulator";
    import { humanReadableSize } from "../utils";

    let files;

    function onLoadClick(save: SaveGameData) {
        Emulator.LoadSave(save);
    }

    function onDownloadClick(save: SaveGameData) {
        const link = document.createElement("a");
        const file = new Blob([save.buffer]);
        link.href = URL.createObjectURL(file);
        link.download = save.filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function onClickUpload() {
        for (const file of files) {
            const buffer = await file.arrayBuffer();
            console.log(
                `Loaded savefile ${file.name} of size ` +
                    humanReadableSize(buffer.byteLength)
            );
            const saveData: SaveGameData = {
                buffer: new Uint8Array(buffer),
                filename: file.name,
            };
            $SaveGames = [saveData, ...$SaveGames];
        }
        files = [];
    }

    function onDeleteClick(save: SaveGameData) {
        SaveGames.update((saves) => {
            saves.splice(saves.indexOf(save), 1);
            return saves;
        });
    }
</script>

<div class="savegame-section">
    <h3>Saves ({$SaveGames.length})</h3>
    <div class="savegames">
        {#each $SaveGames as save}
            <div class="savegame">
                <div>
                    {save.filename} ({humanReadableSize(
                        save.buffer.byteLength
                    )})
                </div>
                <button on:click={() => onLoadClick(save)}>Load</button>
                <button on:click={() => onDownloadClick(save)}>Download</button>
                <button
                    class="delete-button"
                    on:click={() => onDeleteClick(save)}>X</button
                >
            </div>
        {/each}
        <input type="file" bind:files />
        {#if files}
            <button on:click={onClickUpload}>Add...</button>
        {/if}
    </div>
</div>

<style>
    .savegame-section {
        padding: 1em;
        background-color: #1f1f1f;
    }

    .savegame-section > h3 {
        font-size: 1.5em;
        text-align: center;
        margin-bottom: 0.5em;
    }

    .savegames {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.5em;
    }

    .savegame {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.2em;
    }

    .delete-button:hover {
        border-color: red;
    }
</style>
