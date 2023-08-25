<script lang="ts">
  import { RomType } from "../types";
  import { bootRomStore, cartRomStore } from "../stores/romStores";
  import RomDropZone from "./RomDropZone.svelte";
  import RomView from "./RomView.svelte";

  export let romType: RomType;
  export let title: string;

  const storedRomsStore = romType == RomType.Boot ? bootRomStore : cartRomStore;
</script>

<div class="debug-tool-container">
  <h3 class="roms-list-title">
    {title}
  </h3>
  <RomDropZone {romType}>
    <div class="roms-container">
      {#if $storedRomsStore.length > 0}
        {#each $storedRomsStore as item}
          <RomView rom={item} />
        {/each}
      {:else}
        (none)
      {/if}
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
    min-height: 2em;
    max-height: 30em;
    overflow-y: auto;
    width: 30em;
    text-align: center;
  }
</style>
