<script lang="ts">
  import { GbDebugInfoStore } from "../../stores/debugStores";
  import BreakpointsControl from "./BreakpointsControl.svelte";
  import CpuDebugInfo from "./CpuDebugInfo.svelte";
  import DebugControlBar from "./DebugControlBar.svelte";

  import Disassembler from "./Disassembler.svelte";
  import PpuBreakControl from "./PPUBreakControl.svelte";
</script>

<div class="disassembly-container debug-tool-container">
  <h3>Debugger</h3>

  <DebugControlBar />
  <div class="debugger-container">
    <Disassembler />
    <div>
      <PpuBreakControl />
      <BreakpointsControl />
    </div>
  </div>
  {#if $GbDebugInfoStore != undefined}
    <CpuDebugInfo />
  {/if}
</div>

<style>
  .debugger-container {
    display: flex;
    justify-content: center;
    gap: 1em;
  }
</style>
