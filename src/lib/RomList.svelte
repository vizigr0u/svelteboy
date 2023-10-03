<script lang="ts">
  import type { RomReference } from "../types";
  import MyVirtualList from "./MyVirtualList.svelte";
  import RomView from "./RomView.svelte";

  export let title: string;
  export let roms: RomReference[] = [];

  let init = false;
  const romWordsMap: Map<string, RomReference[]> = new Map<
    string,
    RomReference[]
  >();

  let filter: string = "";
  let filteredRoms: RomReference[] = [];

  const maxChars = 5;

  let cacheRomsPromise: Promise<void>;
  $: cacheRomsPromise = cacheRoms();

  function isLetterOrNumber(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "0" && c <= "9");
  }

  function wordIsRelevant(word: string): boolean {
    return (
      word.length >= 2 &&
      isLetterOrNumber(word.charAt(0)) &&
      (",.".includes(word.charAt(-1)) || isLetterOrNumber(word.charAt(-1)))
    );
  }

  async function cacheRoms(): Promise<void> {
    for (let j = 0; j < roms.length; j++) {
      const rom = roms[j];
      if (!rom || !rom.name) continue;
      const relevantWords = rom.name
        .toLowerCase()
        .split(" ")
        .filter(wordIsRelevant);
      for (let k = 0; k < relevantWords.length; k++) {
        const word = relevantWords[k];
        const numChars = Math.min(maxChars, word.length);
        const beginning = word.slice(0, numChars);
        for (let i = 1; i <= numChars; i++) {
          const s = beginning.slice(0, i);
          if (romWordsMap.has(s)) {
            romWordsMap.get(s).push(rom);
          } else {
            romWordsMap.set(s, [rom]);
          }
        }
      }
    }
    await filterRoms();
    init = true;
  }

  async function filterRoms() {
    if (!filter || filter == "" || roms.length == 0) {
      filteredRoms = roms;
      return;
    }
    const lowercaseFilter = filter.slice(0, maxChars).toLowerCase();
    filteredRoms = romWordsMap.has(lowercaseFilter)
      ? romWordsMap.get(lowercaseFilter)
      : [];
  }
</script>

<div class="debug-tool-container">
  <h3 class="roms-list-title">
    {title}
    {#if roms.length > 0}
      ({filteredRoms.length})
    {/if}
  </h3>
  {#if roms.length > 3}
    <label class="roms-filter-input"
      >Search: <input
        type="text"
        bind:value={filter}
        on:input={filterRoms}
        disabled={!init}
      />
    </label>
  {/if}
  {#await cacheRomsPromise}
    <div class="status">
      <i class="fas fa-spinner fa-spin" />
      Caching roms...
    </div>
  {:then}
    {#if filteredRoms.length > 0}
      <div class="roms-container">
        {#if filteredRoms.length > 20}
          <MyVirtualList items={filteredRoms} let:item>
            {#key item.sha1}
              <RomView rom={item} />
            {/key}
          </MyVirtualList>
        {:else}
          {#each filteredRoms as item}
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
  {:catch error}
    <div class="status">
      <span class="errors">{error}</span>
    </div>
  {/await}
</div>

<style>
  .status {
    text-align: center;
    border: 1px solid #333;
    padding: 0.8em;
    font-size: 1.2em;
  }
  .roms-filter-input {
    display: block;
    margin-left: auto;
    text-align: right;
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
