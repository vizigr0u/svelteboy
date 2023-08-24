<script lang="ts">
    import { drawBackgroundMap, getBGTileMap } from "../../../build/release";
    import { GbDebugInfoStore } from "../../stores/debugStores";
    import LcdCanvas from "../LcdCanvas.svelte";

    export let pixelSize = 2;
    export let autodraw: boolean = true;
    export const draw = () => doDraw();

    let tileMap: Uint8Array = new Uint8Array(32 * 32);
    let debug: string = "";
    let drawBG;

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

    function postProcess(ctx: CanvasRenderingContext2D): void {
        tileMap = getBGTileMap(tileMap);
        drawBGLines(ctx);
    }

    function onMouseMove(ev: MouseEvent): void {
        const tileX = Math.floor(Math.max(0, ev.offsetX) / (8 * pixelSize));
        const tileY = Math.floor(Math.max(0, ev.offsetY) / (8 * pixelSize));
        debug = `BG (${tileX}, ${tileY}) = ${tileMap[tileX + tileY * 32]}`;
    }

    function doDraw() {
        drawBG();
    }
</script>

<LcdCanvas
    width={32 * 8}
    height={32 * 8}
    updateBuffer={drawBackgroundMap}
    {postProcess}
    mouseMove={onMouseMove}
    bind:draw={drawBG}
    bind:autodraw
    bind:pixelSize
/>
<span class="debug">{debug}</span>

<style>
    .debug {
        max-width: 30em;
        overflow-x: auto;
    }
</style>
