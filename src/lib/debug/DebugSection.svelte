<script lang="ts">
    import BenchmarkControl from "./BenchmarkControl.svelte";
    import HexDumpControl from "./HexDumpControl.svelte";
    import LogView from "./LogView.svelte";
    import LcdCanvas from "../LcdCanvas.svelte";
    import BgCanvas from "./BGCanvas.svelte";
    import { GbDebugInfoStore } from "../../stores/debugStores";
    import OamView from "./OamView.svelte";
    import Debugger from "./Debugger.svelte";
    import ForceInputControl from "./ForceInputControl.svelte";
    import { GameFrames } from "../../stores/playStores";
    import { Debug } from "../../emulator";

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
                    (hoveredIndex > 127 ? hoveredIndex - 256 : "NONE");
            }
        } else {
            tileDebug += " index = " + hoveredIndex;
        }
    }
</script>

<div class="debug-section">
    <div class="debug-left-panel debug-panel">
        <Debugger />
        <LogView />
        <HexDumpControl />
        <BenchmarkControl />
        <ForceInputControl />
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
            updateBuffer={(a) => Debug.DrawTileData(a, 32 * 8)}
            mouseMove={onMouseMoveOnTiles}
            frameStore={GameFrames}
            bind:draw={drawTiles}
            bind:autodraw
            bind:pixelSize
        />
        <span class="tile-debug">{tileDebug}</span>
        <h4>Background</h4>
        <BgCanvas bind:draw={drawBG} bind:autodraw bind:pixelSize />
        <OamView />
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

    :global(.debug-tool-container > h3) {
        font-size: 1.5em;
        text-align: center;
        margin-bottom: 0.8em;
    }
</style>
