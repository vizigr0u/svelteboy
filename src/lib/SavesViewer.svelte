<script lang="ts">
    import type { SaveGameData } from "../types";
    import { SaveGames } from "stores/playStores";
    import { Emulator } from "../emulator";
    import { humanReadableSize } from "../utils";
    import { loadedCartridge } from "stores/romStores";
    import { DismissSavesWarning } from "stores/optionsStore";

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
                : `showing last ${maxToShow}/${relevantSaves.length}`})
        </h3>
        {#if !$DismissSavesWarning && relevantSaves.length > 0}
            <div class="warning">
                <i class="fa-solid fa-triangle-exclamation" /><span>
                    Saves are NOT persistent (yet), they aren't stored! (Also
                    not well tested)<br /> Don't forget to download the save
                    files you want to keep.<br />
                    Also note that as a convenience I provide every change as a save
                    file, but some games are rather spammy with writing to their
                    RAM.
                </span>
                <button
                    on:click={() => {
                        $DismissSavesWarning = true;
                    }}><i class="fa-solid fa-xmark" /></button
                >
            </div>
        {/if}
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
        {#if relevantSaves.length >= 3}
            <button on:click={onClearAllClick}
                ><i class="fa-solid fa-trash" /> Delete All Saves!</button
            >
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

    .warning {
        position: relative;
        font-weight: 600;
        background-color: #3f2c04;
        display: flex;
        gap: 1em;
        justify-content: start;
        align-items: center;
        margin: 1em 0;
        padding: 0.5em 0.3em;
        --highlight-color: #6f500b;
    }

    .warning > i {
        font-size: 1.9em;
        border-radius: 50%;
        padding: 0.4em;
        background-color: var(--highlight-color);
        text-align: center;
        vertical-align: middle;
    }

    .warning > span {
        max-width: 50em;
    }

    .warning > button {
        position: absolute;
        right: 1em;
        top: 1em;
        background-color: var(--highlight-color);
        border: 0;
        padding: 0.4em;
        margin: 0;
        line-height: 50%;
    }

    .warning > button:hover {
        background-color: #9f7927;
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
