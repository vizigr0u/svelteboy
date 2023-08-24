<script lang="ts">
    import { drawTileData } from "../../../build/release";

    import BenchmarkControl from "./BenchmarkControl.svelte";
    import BreakpointsControl from "./BreakpointsControl.svelte";
    import CpuDebugInfo from "./CpuDebugInfo.svelte";
    import Disassembler from "./Disassembler.svelte";
    import HexDumpControl from "./HexDumpControl.svelte";
    import LogView from "./LogView.svelte";
    import LcdCanvas from "../LcdCanvas.svelte";
    import BgCanvas from "./BGCanvas.svelte";
    import { GbDebugInfoStore } from "../../stores/debugStores";

    let drawTiles;
    let drawBG;
    let pixelSize = 2;
    let autodraw: boolean = true;

    let tileDebug: string = "";

    function onRefreshClick() {
        drawTiles();
        drawBG();
    }

    function onMouseMoveOnTiles(ev: MouseEvent) {
        const tileX = Math.floor(Math.max(0, ev.offsetX) / (8 * pixelSize));
        const tileY = Math.floor(Math.max(0, ev.offsetY) / (8 * pixelSize));
        const hoveredIndex = tileX + tileY * 32;
        tileDebug = `(${tileX}, ${tileY})`;
        tileDebug += ": sprite " + (hoveredIndex < 256 ? hoveredIndex : "NONE");
        if ($GbDebugInfoStore) {
            const TilesOnLow = ($GbDebugInfoStore.lcd.control & (1 << 4)) != 0;
            if (TilesOnLow) {
                tileDebug +=
                    "\t\tBG " + (hoveredIndex < 256 ? hoveredIndex : "NONE");
            } else {
                tileDebug +=
                    "\t\tBG " +
                    (hoveredIndex > 127 ? hoveredIndex - 255 : "NONE");
            }
        } else {
            tileDebug += " index = " + hoveredIndex;
        }
    }
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
    <div class="debug-right-panel debug-panel">
        <div class="canvas-controls">
            <label>
                auto-draw
                <input type="checkbox" bind:checked={autodraw} />
            </label>
            <button on:click={onRefreshClick}>Draw now</button>
            <input type="range" bind:value={pixelSize} min="1" max="10" />
        </div>
        <h4>Tile Data</h4>
        <LcdCanvas
            width={32 * 8}
            height={12 * 8}
            updateBuffer={(a) => drawTileData(a, 32 * 8)}
            mouseMove={onMouseMoveOnTiles}
            bind:draw={drawTiles}
            bind:autodraw
            bind:pixelSize
        />
        <span class="tile-debug">{tileDebug}</span>
        <h4>Background</h4>
        <BgCanvas bind:draw={drawBG} bind:autodraw bind:pixelSize />
    </div>
</div>

<style>
    .debug-section {
        display: flex;
    }
    .debug-panel {
        margin: 0 1em;
        display: flex;
        flex-direction: column;
        justify-content: top;
        align-items: left;
    }

    .canvas-controls {
        display: flex;
        justify-content: left;
        align-items: center;
        gap: 1em;
        /* width: 35em; */
    }

    :global(.debug-tool-container) {
        border: 1px solid #111;
        background-color: #1f1f1f;
        padding: 1em;
        margin: 1em 0;
    }
</style>
