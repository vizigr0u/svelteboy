<script lang="ts">
  import DebuggerLine from "./DebuggerLine.svelte";

  import { type GbDebugInfo, type RomReference } from "../../types";
  import MyVirtualList from "../MyVirtualList.svelte";
  import {
    DebuggerAttached,
    disassembledRomsStore,
    GbDebugInfoStore,
  } from "stores/debugStores";
  import { loadedBootRom, loadedCartridge } from "stores/romStores";
  import { fetchDisassembly } from "../../debug";
  import { EmulatorInitialized, EmulatorPaused } from "stores/playStores";

  let scrollToIndex;
  let lastJumpTime: number = 0;
  const minJumpDelay: number = 200;
  let currentPC = 0;

  $: currentPC =
    $GbDebugInfoStore == undefined ? 0 : $GbDebugInfoStore.registers.PC;

  let lineMap = {};

  loadedCartridge.subscribe((rom) => disassembleRom(rom));

  function disassembleRom(rom: RomReference): void {
    if (rom && $disassembledRomsStore?.sha1 != rom.sha1) {
      console.log("detected new rom to disassemble: " + rom.name);
      fetchDisassembly(rom);
    } else if (!rom) {
      $disassembledRomsStore = undefined;
    }
  }

  EmulatorInitialized.subscribe((initialized) => {
    if (
      $DebuggerAttached &&
      initialized &&
      $disassembledRomsStore != undefined
    ) {
      scrollToIndex(0);
    }
  });

  disassembledRomsStore.subscribe((info) => {
    if (info == undefined) {
      lineMap = {};
      return;
    }
    const d = {};
    info.programLines.forEach((line, index) => {
      d[line.pc] = index;
    });
    lineMap = d;
  });

  GbDebugInfoStore.subscribe((info: GbDebugInfo) => {
    if (!info) return;
    const t = performance.now();
    const lineNumber = lineMap[info.registers.PC.toString()];
    if (
      lineNumber !== undefined &&
      (lineNumber < firstLine || lineNumber > lastLine) &&
      (lastJumpTime == 0 || $EmulatorPaused || t - lastJumpTime > minJumpDelay)
    ) {
      scrollToIndex(Math.max(0, lineNumber - 5));
      lastJumpTime = t;
    }
  });

  let firstLine;
  let lastLine;
</script>

<div class="disassembly-container">
  <div class="container">
    <div class="title-bar">
      <div class="filename">
        {$disassembledRomsStore?.name ?? "No file loaded"}
      </div>
    </div>

    <MyVirtualList
      items={$disassembledRomsStore?.programLines ?? []}
      bind:start={firstLine}
      bind:end={lastLine}
      bind:scrollToIndex
      let:item
    >
      <DebuggerLine line={item} highlighted={item.pc == currentPC} />
    </MyVirtualList>
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

  .title-bar {
    display: flex;
    justify-content: space-between;
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
