<script lang="ts">
    import { drawTileData, drawBackgroundMap } from "../../../build/release";

    import BenchmarkControl from "./BenchmarkControl.svelte";
    import BreakpointsControl from "./BreakpointsControl.svelte";
    import CpuDebugInfo from "./CpuDebugInfo.svelte";
    import Disassembler from "./Disassembler.svelte";
    import HexDumpControl from "./HexDumpControl.svelte";
    import LogView from "./LogView.svelte";
    import { GbDebugInfoStore } from "../../stores/debugStores";
    import LcdCanvas from "../LcdCanvas.svelte";

    let drawTiles;
    let drawBG;
    let pixelSize = 2;
    let autodraw: boolean = true;

    function onRefreshClick() {
        drawTiles();
        drawBG();
    }

    function drawBGLines(ctx: CanvasRenderingContext2D): void {
        const minX = $GbDebugInfoStore.lcd.scX;
        const minY = $GbDebugInfoStore.lcd.scY;
        const maxX = (160 + minX) % ctx.canvas.width;
        const maxY = (144 + minY) % ctx.canvas.height;
        ctx.strokeStyle = "red";
        ctx.beginPath();
        if (minX < maxX) {
            ctx.moveTo(minX, minY);
            ctx.lineTo(maxX, minY);
            ctx.moveTo(minX, maxY);
            ctx.lineTo(maxX, maxY);
        } else {
            ctx.moveTo(0, minY);
            ctx.lineTo(maxX, minY);
            ctx.moveTo(minX, minY);
            ctx.lineTo(159, minY);
            ctx.moveTo(0, maxY);
            ctx.lineTo(maxX, maxY);
            ctx.moveTo(minX, maxY);
            ctx.lineTo(159, maxY);
        }
        if (minY < maxY) {
            ctx.moveTo(minX, minY);
            ctx.lineTo(minX, maxY);
            ctx.moveTo(maxX, minY);
            ctx.lineTo(maxX, maxY);
        } else {
            ctx.moveTo(minX, 0);
            ctx.lineTo(minX, maxY);
            ctx.moveTo(minX, minY);
            ctx.lineTo(minX, 143);
            ctx.moveTo(maxX, 0);
            ctx.lineTo(maxX, maxY);
            ctx.moveTo(maxX, minY);
            ctx.lineTo(maxX, 143);
        }
        ctx.stroke();
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
            height={16 * 8}
            updateBuffer={(a) => drawTileData(a, 32 * 8)}
            bind:draw={drawTiles}
            bind:autodraw
            bind:pixelSize
        />
        <h4>Background</h4>
        <LcdCanvas
            width={32 * 8}
            height={32 * 8}
            updateBuffer={drawBackgroundMap}
            postProcess={drawBGLines}
            bind:draw={drawBG}
            bind:autodraw
            bind:pixelSize
        />
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
