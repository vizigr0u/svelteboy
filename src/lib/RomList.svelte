<script lang="ts">
  import type { LibraryRom } from "../types";
  import MyVirtualList from "./MyVirtualList.svelte";
  import RomView from "./RomView.svelte";

  let { title, roms = [] } = $props<{ title: string; roms?: LibraryRom[] }>();
</script>

<div class="debug-tool-container">
  <h3 class="roms-list-title">
    {title}
    {#if roms.length > 0}
      ({roms.length})
    {/if}
  </h3>
  {#if roms.length > 0}
    <div class="roms-container">
      {#if roms.length > 20}
        <MyVirtualList items={roms}>
          {#snippet children(item)}
            {#key item.sha1}
              <RomView rom={item} />
            {/key}
          {/snippet}
        </MyVirtualList>
      {:else}
        {#each roms as item}
          {#key item.sha1}
            <RomView rom={item} />
          {/key}
        {/each}
      {/if}
    </div>
  {:else}
    <div class="status">
      <span class="roms-count">(none)</span>
    </div>
  {/if}
</div>

<style>
  .status {
    text-align: center;
    border: 1px solid #333;
    padding: 0.8em;
    font-size: 1.2em;
  }
  .roms-container {
    display: flex;
    flex-direction: column;
    padding: 0.3em 0.5em;
    border: 1px solid #424242;
    background-color: var(--subsection-bg-color);
    min-height: 2em;
    height: 30em;
    overflow-y: auto;
    margin: auto;
    max-width: 95%;
    text-align: center;
  }
</style>
