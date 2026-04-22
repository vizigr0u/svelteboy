<script lang="ts">
    import BenchmarkControl from "./BenchmarkControl.svelte";
    import HexDumpControl from "./HexDumpControl.svelte";
    import LogView from "./LogView.svelte";
    import LcdCanvas from "../LcdCanvas.svelte";
    import BgCanvas from "./BGCanvas.svelte";
    import { DebuggerAttached, GbDebugInfoStore } from "stores/debugStores";
    import OamView from "./OamView.svelte";
    import Debugger from "./Debugger.svelte";
    import ForceInputControl from "./ForceInputControl.svelte";
    import CpuDebugInfo from "./CpuDebugInfo.svelte";
    import { GameFrames } from "stores/playStores";
    import { Debug } from "../../emulator";
    import AudioDebug from "./AudioDebug.svelte";
    import { debugPanels } from "../../stores/windowStores";

    const { debugger: showDebugger, cpu: showCpu, logs: showLogs, hexDump: showHexDump,
            audio: showAudio, oam: showOam, bgCanvas: showBgCanvas, benchmark: showBenchmark } = debugPanels;

    let pixelSize = $state(2);
    let autodraw: boolean = $state(true);
    let tileDebug: string = $state("");
    let panelMenuOpen: boolean = $state(false);


    function onMouseMoveOnTiles(ev: MouseEvent) {
        const tileX = Math.floor(Math.max(0, ev.offsetX) / (8 * pixelSize));
        const tileY = Math.floor(Math.max(0, ev.offsetY) / (8 * pixelSize));
        const hoveredIndex = tileX + tileY * 32;
        tileDebug = `(${tileX}, ${tileY})`;
        tileDebug += ": sprite " + (hoveredIndex < 256 ? hoveredIndex : "NONE");
        if ($GbDebugInfoStore) {
            const TilesOnLow = ($GbDebugInfoStore.lcd.control & (1 << 4)) != 0;
            if (TilesOnLow) {
                tileDebug += "\t\tBG " + (hoveredIndex < 256 ? hoveredIndex : "NONE");
            } else {
                tileDebug += "\t\tBG " + (hoveredIndex > 127 ? hoveredIndex - 256 : "NONE");
            }
        } else {
            tileDebug += " index = " + hoveredIndex;
        }
    }
</script>

<div class="debug-section">
    <div class="debug-panel-bar">
        <button class="panel-menu-btn" onclick={() => panelMenuOpen = !panelMenuOpen} aria-label="Panels">Panels ▾</button>
        {#if panelMenuOpen}
            <div class="panel-menu">
                <button class="panel-menu-item" class:active={$showDebugger} onclick={() => showDebugger.update(v => !v)}>Debugger</button>
                <button class="panel-menu-item" class:active={$showCpu}      onclick={() => showCpu.update(v => !v)}>CPU Info</button>
                <button class="panel-menu-item" class:active={$showLogs}     onclick={() => showLogs.update(v => !v)}>Logs</button>
                <button class="panel-menu-item" class:active={$showHexDump}  onclick={() => showHexDump.update(v => !v)}>Hex Dump</button>
                <button class="panel-menu-item" class:active={$showAudio}    onclick={() => showAudio.update(v => !v)}>Audio</button>
                <button class="panel-menu-item" class:active={$showOam}      onclick={() => showOam.update(v => !v)}>OAM View</button>
                <button class="panel-menu-item" class:active={$showBgCanvas} onclick={() => showBgCanvas.update(v => !v)}>BG/Tiles</button>
                <button class="panel-menu-item" class:active={$showBenchmark} onclick={() => showBenchmark.update(v => !v)}>Benchmark</button>
            </div>
        {/if}
    </div>

    {#if $showDebugger}
        <Debugger />
    {/if}
    {#if $showCpu}
        <div class="debug-tool-container">
            <h3>CPU Info</h3>
            <CpuDebugInfo />
        </div>
    {/if}
    {#if $showAudio}
        <AudioDebug />
    {/if}
    {#if $showLogs}
        <LogView />
    {/if}
    {#if $showHexDump}
        <HexDumpControl />
    {/if}
    {#if $showOam}
        <OamView />
    {/if}
    {#if $showBgCanvas}
        <div class="debug-tool-container">
            <h3>BG / Tiles</h3>
            <div class="canvas-controls">
                <label>
                    auto-draw
                    <input type="checkbox" bind:checked={autodraw} />
                </label>
                <input type="range" bind:value={pixelSize} min="1" max="10" />
            </div>
            <h4>Tile Data</h4>
            <LcdCanvas
                width={32 * 8}
                height={12 * 8}
                updateBuffer={(a) => Debug.DrawTileData(a, 32 * 8)}
                mouseMove={onMouseMoveOnTiles}
                frameStore={GameFrames}
                autodraw={autodraw && $DebuggerAttached}
                bind:pixelSize
            />
            <span class="tile-debug">{tileDebug}</span>
            <h4>Background</h4>
            <BgCanvas
                autodraw={autodraw && $DebuggerAttached}
                bind:pixelSize
            />
        </div>
    {/if}
    {#if $showBenchmark}
        <BenchmarkControl />
        <ForceInputControl />
    {/if}
</div>

<style>
    .debug-section {
        display: flex;
        flex-direction: column;
        gap: 0.25em;
    }

    .debug-panel-bar {
        position: relative;
        display: flex;
        align-items: center;
        padding: 0.25em 0;
        border-bottom: 1px solid #45475a;
        margin-bottom: 0.25em;
    }

    .panel-menu-btn {
        background: #313244;
        border: 1px solid #45475a;
        color: #cdd6f4;
        padding: 0.25em 0.75em;
        border-radius: 0.3em;
        cursor: pointer;
        font-size: 0.85em;
    }

    .panel-menu-btn:hover {
        background: #45475a;
    }

    .panel-menu {
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 300;
        background: #1e1e2e;
        border: 1px solid #45475a;
        border-radius: 0.4em;
        display: flex;
        flex-direction: column;
        min-width: 140px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        overflow: hidden;
    }

    .panel-menu-item {
        background: none;
        border: none;
        color: #cdd6f4;
        padding: 0.5em 1em;
        text-align: left;
        cursor: pointer;
        font-size: 0.85em;
    }

    .panel-menu-item:hover {
        background: #313244;
    }

    .panel-menu-item.active {
        color: #a6e3a1;
    }

    .panel-menu-item.active::before {
        content: "✓ ";
    }

    .canvas-controls {
        display: flex;
        align-items: center;
        gap: 1em;
        flex-wrap: wrap;
    }

    :global(.debug-tool-container) {
        border: 1px solid #111;
        background-color: var(--section-bg-color);
        padding: 1em;
        margin: 0.5em 0;
    }

    :global(.debug-tool-container > h3) {
        font-size: 1.5em;
        text-align: center;
        margin-bottom: 0.8em;
    }
</style>
