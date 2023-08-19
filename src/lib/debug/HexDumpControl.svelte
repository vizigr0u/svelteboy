<script lang="ts">
  import { getHexDump } from "../../debug";
  import HexView from "./HexView.svelte";

  let promise: Promise<Uint8Array> = undefined;
  let minPC: number = 0x100;
  let maxPC: number = 0x300;

  function onClick() {
    promise = getHexDump(minPC, maxPC);
  }
</script>

<div class="hex-viewer debug-tool-container">
  <h4>Hex Viewer</h4>
  <div class="hex-viewer-controls">
    <div>
      <div class="hex-bound-view">
        <input type="number" bind:value={minPC} min="0" max="65535" />
        <div />
      </div>

      <div class="hex-bound-view">
        <input type="number" bind:value={maxPC} min="0" max="65535" />
        <div />
      </div>
    </div>

    <button on:click={onClick}
      >Fetch from 0x{minPC.toString(16).padStart(4, "0")} to 0x{maxPC
        .toString(16)
        .padStart(4, "0")}</button
    >
  </div>

  <div class="hex-result-display">
    {#if promise}
      {#await promise}
        <p>Fetching...</p>
      {:then data}
        <HexView dataArray={data} startPC={minPC} />
      {:catch error}
        <p style="color: red">{error.message}</p>
      {/await}
    {:else}
      <p>Nothing to display</p>
    {/if}
  </div>
</div>

<style>
  .hex-viewer-controls {
    display: flex;
    align-items: center;
    /* justify-content: space-around; */
    gap: 2em;
  }

  .hex-bound-view {
    display: flex;
    justify-content: center;
  }

  .hex-bound-view > input {
    width: 6em;
  }
  .hex-viewer-controls input,
  .hex-viewer-controls button {
    border: 1px solid #555;
  }
</style>
