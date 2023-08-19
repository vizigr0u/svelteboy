<script lang="ts">
    import BenchmarkControl from "./BenchmarkControl.svelte";
    import BreakpointsControl from "./BreakpointsControl.svelte";
    import CpuDebugInfo from "./CpuDebugInfo.svelte";
    import DebugLcd from "./DebugLcd.svelte";
    import Disassembler from "./Disassembler.svelte";
    import HexDumpControl from "./HexDumpControl.svelte";
    import LogView from "./LogView.svelte";
</script>

<div class="debug-section">
    <div class="debug-left-panel debug-panel">
        <Disassembler />
        <CpuDebugInfo />
        <LogView />
        <BreakpointsControl />
        <HexDumpControl />
        <BenchmarkControl />
    </div>
    <DebugLcd />
    <div class="debug-right-panel debug-panel" />
</div>

<style>
    .debug-section {
        display: flex;
    }
    .debug-panel {
        margin: 0 1em;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: left;
    }

    :global(.debug-tool-container) {
        border: 1px solid #111;
        background-color: #1f1f1f;
        padding: 1em;
        margin: 1em 0;
    }
</style>
