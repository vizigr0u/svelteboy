<script lang="ts">
  import { Debug } from "../../emulator";
  import { DebuggerAttached, GbDebugInfoStore } from "stores/debugStores";
  import BreakpointsControl from "./BreakpointsControl.svelte";
  import CpuDebugInfo from "./CpuDebugInfo.svelte";
  import DebugControlBar from "./DebugControlBar.svelte";

  import Disassembler from "./Disassembler.svelte";
  import PpuBreakControl from "./PPUBreakControl.svelte";

  DebuggerAttached.subscribe((attach) => {
    attach ? Debug.AttachDebugger() : Debug.DetachDebugger();
  });
</script>

<div class="disassembly-container debug-tool-container">
  <h3 class:title-detached={$DebuggerAttached}>
    <input
      class="debugger-attach-toggle"
      type="checkbox"
      checked={$DebuggerAttached}
      on:change={() => ($DebuggerAttached = !$DebuggerAttached)}
    />
    Debugger {$DebuggerAttached ? "" : "(detached)"}
  </h3>

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
  .title-detached {
    color: #aaa;
  }
  .debugger-attach-toggle {
    width: 1em;
    height: 1em;
  }
</style>
