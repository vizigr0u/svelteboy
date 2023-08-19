<script lang="ts">
  import { loadBootRom, loadCartridgeRom } from "../../build/release";
  import type { StoredRom } from "../types";
  import { RomType } from "../types";
  import {
    bootRomStore,
    cartRomStore,
    loadedRomsStore,
    setLoadedRom,
  } from "../stores/romStores";
  import { humanReadableSize } from "../utils";
  import RomDropZone from "./RomDropZone.svelte";

  export let romType: RomType;
  export let title: string;

  let isLoading: boolean = false;

  const storedRomsStore = romType == RomType.Boot ? bootRomStore : cartRomStore;

  const loadFunction: (a: ArrayBuffer) => boolean =
    romType == RomType.Boot ? loadBootRom : loadCartridgeRom;

  function tryLoadRom(item: StoredRom): Promise<boolean> {
    return new Promise<boolean>((resolve) =>
      resolve(loadFunction(Buffer.from(item.contentBase64, "base64")))
    );
  }

  async function loadRom(item: StoredRom): Promise<void> {
    const loaded = await tryLoadRom(item);
    if (!loaded) {
      console.log(`Error loading ${item.filename}`);
      return;
    }

    setLoadedRom(romType, {
      uuid: item.uuid,
      filename: item.filename,
      romType,
    });
  }

  function deleteRom(item: StoredRom) {
    if ($loadedRomsStore[romType]?.uuid == item.uuid) {
      setLoadedRom(romType, undefined);
    }
    $storedRomsStore = $storedRomsStore.filter((r) => r.uuid !== item.uuid);
  }
</script>

<div>
  <h3>{$storedRomsStore.length} {title}</h3>
  <RomDropZone {romType}>
    <div class="roms-container">
      {#each $storedRomsStore as item}
        <div
          class="rom-container"
          class:rom-loaded={$loadedRomsStore[romType]?.uuid == item.uuid}
        >
          <div class="filename">
            {item.filename}<br />({humanReadableSize(item.fileSize)})
          </div>
          <div class="rom-action-buttons">
            <button
              class="rom-action-button"
              on:click={() => loadRom(item)}
              disabled={isLoading ||
                $loadedRomsStore[romType]?.uuid == item.uuid}
              >{$loadedRomsStore[romType]?.uuid == item.uuid
                ? isLoading
                  ? "LOADING..."
                  : "LOADED"
                : "LOAD"}</button
            >
            <button
              class="rom-action-button"
              on:click={() => deleteRom(item)}
              disabled={isLoading}>Delete</button
            >
          </div>
        </div>
      {/each}
    </div>
  </RomDropZone>
</div>

<style>
  .roms-container {
    display: flex;
    flex-direction: column;
    padding: 0.3em 0.5em;
    border: 1px solid #424242;
    background-color: #222222;
    max-height: 20em;
    overflow-y: auto;
  }

  .rom-container {
    font-size: small;
    padding: 0.3em 0.5em;
    border: 1px solid #424242;
    background-color: #323232;
    /* width: 15em; */
    /* min-height: 7em; */
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .filename {
    width: 16em;
    font-size: 1.1em;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
  }
  .rom-action-buttons {
    display: flex;
    justify-content: space-around;
  }

  .rom-action-button {
    padding: 0.2em 0.5em;
    border-radius: 0;
  }

  .rom-loaded {
    background-color: #27312a;
  }
</style>
