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

  let virtualList = $state(null);
  let lastJumpTime: number = 0;
  const minJumpDelay: number = 200;

  let currentPC = $derived(
    $GbDebugInfoStore == undefined ? 0 : $GbDebugInfoStore.registers.PC
  );

  let lineMap: Record<string, number> = $state({});

  let firstLine: number = $state(0);
  let lastLine: number = $state(0);

  $effect(() => {
    return loadedCartridge.subscribe((rom) => disassembleRom(rom));
  });

  function disassembleRom(rom: RomReference): void {
    if (rom && $disassembledRomsStore?.sha1 != rom.sha1) {
      fetchDisassembly(rom);
    } else if (!rom) {
      $disassembledRomsStore = undefined;
    }
  }

  $effect(() => {
    return EmulatorInitialized.subscribe((initialized) => {
      if ($DebuggerAttached && initialized && $disassembledRomsStore != undefined) {
        virtualList?.scrollToIndex(0);
      }
    });
  });

  $effect(() => {
    return disassembledRomsStore.subscribe((info) => {
      if (info == undefined) {
        lineMap = {};
        return;
      }
      const d: Record<string, number> = {};
      info.programLines.forEach((line, index) => {
        d[line.pc] = index;
      });
      lineMap = d;
    });
  });

  $effect(() => {
    return GbDebugInfoStore.subscribe((info: GbDebugInfo) => {
      if (!info) return;
      const t = performance.now();
      const lineNumber = lineMap[info.registers.PC.toString()];
      if (
        lineNumber !== undefined &&
        (lineNumber < firstLine || lineNumber > lastLine) &&
        (lastJumpTime == 0 || $EmulatorPaused || t - lastJumpTime > minJumpDelay)
      ) {
        virtualList?.scrollToIndex(Math.max(0, lineNumber - 5));
        lastJumpTime = t;
      }
    });
  });
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
      bind:this={virtualList}
    >
      {#snippet children(item)}
        <DebuggerLine line={item} highlighted={item.pc == currentPC} />
      {/snippet}
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
    background-color: var(--subsection-bg-color);
    color: var(--text-faded-color);
    display: flex;
    flex-direction: column;
    gap: 0.3em;
    min-width: 25em;
    max-width: 30em;
  }
</style>
