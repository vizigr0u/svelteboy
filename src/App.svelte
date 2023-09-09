<script lang="ts">
  import DebugSection from "./lib/debug/DebugSection.svelte";
  import OptionsView from "./lib/OptionsView.svelte";
  import Player from "./lib/Player.svelte";
  import RomDropZone from "./lib/RomDropZone.svelte";
  import RomList from "./lib/RomList.svelte";
  import SavesViewer from "./lib/SavesViewer.svelte";
  import {
    CachedRemoteRoms,
    RemoteRomsListUri,
    FetchingRemoteRoms,
  } from "./stores/optionsStore";
  import { cartRomStore } from "./stores/romStores";
  import { DragState, type RemoteRom, type RomReference } from "./types";

  let dragState: DragState;
  let dragStatus: string;
</script>

<div class="page-container">
  <main>
    <Player />
    <SavesViewer />
    {#if $FetchingRemoteRoms}
      <span class="loading-roms-text"
        ><i class="fas fa-spinner fa-spin" /> Fetching {$RemoteRomsListUri}...</span
      >
    {:else}
      <RomList title="Hosted roms" roms={$CachedRemoteRoms} />
    {/if}

    <RomDropZone bind:dragState bind:dragStatus>
      <div
        class="dropzone-hint"
        class:drop-allowed={dragState == DragState.Accept}
        class:drop-disallowed={dragState == DragState.Reject}
      >
        <RomList title="Local roms" roms={$cartRomStore} />
        <p>
          Drop your rom files here
          <span>{dragStatus}</span>
        </p>
      </div>
    </RomDropZone>
    <OptionsView />
  </main>
  <aside>
    <DebugSection />
  </aside>
</div>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 2em;
  }
  .page-container {
    width: 100%;
    display: flex;
    justify-content: left;
    gap: 2em;
  }
  .dropzone-hint {
    margin: 0.5em;
    padding: 0.5em;
    background-color: #222;
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
</style>
