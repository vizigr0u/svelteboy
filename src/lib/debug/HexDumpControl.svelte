<script lang="ts">
  import { getHexDump } from "../../debug";
  import { type MemArea } from "../../types";
  import { uToHex16 } from "../../utils";
  import HexView from "./HexView.svelte";

  const customName = "Custom...";

  const areas: MemArea[] = [
    { name: "ROM_0", start: 0, size: 0x4000 },
    { name: "ROM_1", start: 0x4000, size: 0x4000 },
    { name: "Video", start: 0x8000, size: 0x2000 },
    { name: "TileMap 0", start: 0x9800, size: 0x400 },
    { name: "TileMap 1", start: 0x9c00, size: 0x400 },
    { name: "Ext_RAM", start: 0xa000, size: 0x2000 },
    { name: "Work_RAM_0", start: 0xc000, size: 0x1000 },
    { name: "Work_RAM_1", start: 0xd000, size: 0x1000 },
    { name: "OAM", start: 0xfe00, size: 0xa0 },
    { name: "IOs", start: 0xff00, size: 0x80 },
    { name: "High_RAM", start: 0xff80, size: 0x80 },
    { name: customName, start: 0xff80, size: 0x80 },
  ];

  let promise: Promise<Uint8Array> = undefined;
  let index = 0;

  let minPC: number = areas[0].start;
  let count: number = areas[0].size;

  let selectedArea: MemArea;

  function onClick() {
    promise = getHexDump(minPC, count);
  }

  $: {
    minPC = selectedArea?.start ?? areas[0].start;
    count = selectedArea?.size ?? areas[0].size;
  }
</script>

<div class="hex-viewer debug-tool-container">
  <h3>Hex Viewer</h3>
  <div class="hex-viewer-controls">
    <select bind:value={selectedArea}>
      {#each areas as area}
        <option value={area}>
          {`${area.name}`}
        </option>
      {/each}
    </select>
    {#if selectedArea && selectedArea.name == customName}
      <div class="custom-hex-form">
        <div class="hex-bound-view">
          <input type="number" bind:value={minPC} min="0" max="65535" />
          <div />
        </div>

        <div class="hex-bound-view">
          <input type="number" bind:value={count} min="0" max="65535" />
          <div />
        </div>
      </div>
    {/if}

    <button on:click={onClick}
      >Fetch from {uToHex16(minPC)} to {uToHex16(minPC + count)}</button
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

  .custom-hex-form {
    display: flex;
  }

  .hex-bound-view > input {
    width: 6em;
  }
  .hex-viewer-controls input,
  .hex-viewer-controls button {
    border: 1px solid #555;
  }
</style>
