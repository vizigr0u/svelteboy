<script lang="ts">
    import { drawTileData } from "../../../build/release";

    import BenchmarkControl from "./BenchmarkControl.svelte";
    import CpuDebugInfo from "./CpuDebugInfo.svelte";
    import HexDumpControl from "./HexDumpControl.svelte";
    import LogView from "./LogView.svelte";
    import LcdCanvas from "../LcdCanvas.svelte";
    import BgCanvas from "./BGCanvas.svelte";
    import { DebugFrames, GbDebugInfoStore } from "../../stores/debugStores";
    import OamView from "./OamView.svelte";
    import Debugger from "./Debugger.svelte";
    import { KeyPressMap } from "../../stores/playStores";
    import { InputType } from "../../types";

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
        <CpuDebugInfo />
        <LogView />
        <HexDumpControl />
        <BenchmarkControl />
        <div>
            A <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.A)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked) $KeyPressMap.add(InputType.A);
                    else $KeyPressMap.delete(InputType.A);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
            B
            <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.B)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked) $KeyPressMap.add(InputType.B);
                    else $KeyPressMap.delete(InputType.B);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
            Up
            <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.Up)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked)
                        $KeyPressMap.add(InputType.Up);
                    else $KeyPressMap.delete(InputType.Up);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
            Down
            <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.Down)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked)
                        $KeyPressMap.add(InputType.Down);
                    else $KeyPressMap.delete(InputType.Down);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
            Left
            <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.Left)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked)
                        $KeyPressMap.add(InputType.Left);
                    else $KeyPressMap.delete(InputType.Left);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
            Right
            <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.Right)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked)
                        $KeyPressMap.add(InputType.Right);
                    else $KeyPressMap.delete(InputType.Right);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
            Start
            <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.Start)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked)
                        $KeyPressMap.add(InputType.Start);
                    else $KeyPressMap.delete(InputType.Start);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
            Select
            <input
                type="checkbox"
                value={$KeyPressMap.has(InputType.Select)}
                on:change={(ev) => {
                    if (ev.currentTarget.checked)
                        $KeyPressMap.add(InputType.Select);
                    else $KeyPressMap.delete(InputType.Select);
                    $KeyPressMap = $KeyPressMap;
                }}
            />
        </div>
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
            frameStore={DebugFrames}
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
