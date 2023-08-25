<script lang="ts">
  import BreakpointsControl from "./BreakpointsControl.svelte";
  import DebugControlBar from "./DebugControlBar.svelte";

  import Disassembler from "./Disassembler.svelte";
</script>

<div class="disassembly-container debug-tool-container">
  <h3>Debugger</h3>

  <DebugControlBar />
  <div class="debugger-container">
    <Disassembler />
    <BreakpointsControl />
  </div>
</div>

<style>
  .debugger-container {
    display: flex;
    justify-content: center;
    gap: 1em;
  }
</style>
