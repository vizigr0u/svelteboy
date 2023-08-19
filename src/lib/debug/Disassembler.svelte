<script lang="ts">
  import DebuggerLine from "./DebuggerLine.svelte";
  import DebugControlBar from "./DebugControlBar.svelte";

  import { RomType, type GbDebugInfo } from "../../types";
  import VirtualList from "svelte-virtual-list-ce";
  import {
    disassembledRomsStore,
    GbDebugInfoStore,
    DebugSessionStarted,
  } from "../../stores/debugStores";
  import { loadedRomsStore } from "../../stores/romStores";
  import { fetchDisassembly } from "../../debug";

  let romToShow: RomType = RomType.Boot;
  let scrollToIndex;

  let lineMaps = [{}, {}];

  loadedRomsStore.subscribe((roms) => {
    roms.forEach((rom) => {
      if (rom && $disassembledRomsStore[rom.romType]?.uuid != rom.uuid) {
        console.log("detected new rom to disassemble: " + rom.filename);
        fetchDisassembly(rom);
        romToShow = rom.romType;
      }
    });
  });

  DebugSessionStarted.subscribe((debugStarted) => {
    if (
      !debugStarted &&
      scrollToIndex &&
      $disassembledRomsStore[romToShow] != undefined
    ) {
      scrollToIndex(0);
    }
  });

  disassembledRomsStore.subscribe((infoByRoms) => {
    infoByRoms.forEach((romInfo) => {
      const d = {};
      romInfo.programLines.forEach((line, index) => {
        d[line.pc] = index;
      });
      lineMaps[romInfo.romType] = d;
    });
  });

  GbDebugInfoStore.subscribe((info: GbDebugInfo) => {
    if (!info) return;
    const lineNumber = lineMaps[romToShow][info.registers.PC.toString()];
    if (
      lineNumber !== undefined &&
      (lineNumber < firstLine || lineNumber > lastLine)
    )
      scrollToIndex(Math.max(0, lineNumber - 5));
  });

  let firstLine;
  let lastLine;

  const allRomTypes = Object.keys(RomType).filter((v) => isNaN(Number(v)));
</script>

<div class="disassembly-container debug-tool-container">
  <h4>Disassembly</h4>

  <div class="tab-select-container">
    {#each allRomTypes as romTypeName}
      <button
        disabled={romToShow == RomType[romTypeName]}
        on:click={() => (romToShow = RomType[romTypeName])}
        >{romTypeName}</button
      >
    {/each}
  </div>

  <div class="container">
    <DebugControlBar />
    <div class="filename">
      {$disassembledRomsStore[romToShow]?.filename ?? "No file loaded"}
    </div>
    <VirtualList
      items={$disassembledRomsStore[romToShow]?.programLines ?? []}
      bind:start={firstLine}
      bind:end={lastLine}
      bind:scrollToIndex
      let:item
    >
      <DebuggerLine
        line={item}
        highlighted={item.pc ==
          ($DebugSessionStarted && !!$GbDebugInfoStore
            ? $GbDebugInfoStore.registers.PC
            : 0)}
      />
    </VirtualList>
  </div>
</div>

<style>
  .disassembly-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.3em;
  }

  .container {
    border-top: 1px solid #333;
    border-bottom: 1px solid #333;
    min-height: 10em;
    height: 25em;
    background-color: #222;
    color: rgb(142, 152, 167);
    display: flex;
    flex-direction: column;
    gap: 0.3em;
    min-width: 25em;
    max-width: 30em;
  }
</style>
