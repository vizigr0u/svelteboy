<script lang="ts">
  import type { RomReference } from "../types";
  import RomView from "./RomView.svelte";

  export let title: string;
  export let romsPromise: Promise<RomReference[]>;
  export let loadingListText: string;

  let init = false;
  let roms: RomReference[] = [];
  const romWordsMap: Map<string, RomReference[]> = new Map<
    string,
    RomReference[]
  >();

  let filter: string = "";
  let filteredRoms: RomReference[] = [];

  const maxChars = 5;

  let cacheRomsPromise: Promise<void> = cacheRoms();

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
    console.log("Cache miss romsPromise");
    roms = await romsPromise;
    for (let j = 0; j < roms.length; j++) {
      const rom = roms[j];
      const relevantWords = rom.name
        .toLowerCase()
        .split(" ")
        .filter(wordIsRelevant);
      console.log(rom.name + "-> " + JSON.stringify(relevantWords));
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
    if (!filter || filter == "") {
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
  </h3>
  <input
    type="text"
    bind:value={filter}
    on:input={filterRoms}
    disabled={!init}
  />
  {#await cacheRomsPromise}
    <span class="loading-list"
      >{loadingListText}<i class="fas fa-spinner fa-spin" /></span
    >
  {:then}
    {#if filteredRoms.length > 0}
      <span class="roms-count">{filteredRoms.length} roms found</span>
      <div class="roms-container">
        {#each filteredRoms as item}
          <RomView rom={item} />
        {/each}
      </div>
    {:else}
      <span class="roms-count">(none)</span>
    {/if}
  {:catch error}
    <span class="errors">{error}</span>
  {/await}
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
