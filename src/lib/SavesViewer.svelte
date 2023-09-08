<script lang="ts">
    import type { SaveGameData } from "../types";
    import { SaveGames } from "../stores/playStores";
    import { Emulator } from "../emulator";
    import { humanReadableSize } from "../utils";
    import { loadedCartridge } from "../stores/romStores";

    const maxToShow = 50;

    let files;
    let relevantSaves = [];

    function onLoadClick(save: SaveGameData) {
        Emulator.LoadSave(save);
    }

    function onDownloadClick(save: SaveGameData) {
        const link = document.createElement("a");
        const file = new Blob([save.buffer]);
        link.href = URL.createObjectURL(file);
        link.download = $loadedCartridge.name + ".sav";
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
                name: file.name,
                gameSha1: $loadedCartridge.sha1,
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

    function updateRelevantSaves() {
        if ($loadedCartridge == undefined) {
            relevantSaves = [];
            return;
        }
        const currentSha1 = $loadedCartridge.sha1;
        relevantSaves = $SaveGames.filter((s) => s.gameSha1 == currentSha1);
    }

    loadedCartridge.subscribe(updateRelevantSaves);
    SaveGames.subscribe(updateRelevantSaves);

    function onClearAllClick() {
        SaveGames.update((saves) => {
            return saves.filter((s) => s.gameSha1 != $loadedCartridge.sha1);
        });
    }
</script>

{#if $loadedCartridge !== undefined}
    <div class="savegame-section">
        <h3>
            Saves ({relevantSaves.length <= maxToShow
                ? relevantSaves.length.toString()
                : ` showing ${maxToShow}/${relevantSaves.length}`})
            {#if relevantSaves.length >= 3}
                <button on:click={onClearAllClick}>Clear All!</button>
            {/if}
        </h3>
        <div class="savegames">
            {#each relevantSaves.slice(-50) as save}
                <div class="savegame">
                    <div>
                        {save.name} ({humanReadableSize(
                            save.buffer.byteLength
                        )})
                    </div>
                    <button on:click={() => onLoadClick(save)}>Load</button>
                    <button on:click={() => onDownloadClick(save)}
                        ><i class="fa-solid fa-cloud-arrow-down" /></button
                    >
                    <button
                        class="delete-button"
                        on:click={() => onDeleteClick(save)}
                        ><i class="fa-solid fa-trash" /></button
                    >
                </div>
            {/each}
        </div>
        <label>Add save: <input type="file" bind:files /></label>
        {#if files}
            <button on:click={onClickUpload}>Add...</button>
        {/if}
    </div>
{/if}

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
        max-height: 20em;
        overflow-y: auto;
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
