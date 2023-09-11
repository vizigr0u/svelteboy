<script lang="ts">
    import { Debug } from "../../emulator";
    import { GbDebugInfoStore } from "stores/debugStores";
    import { GameFrames } from "stores/playStores";
    import LcdCanvas from "../LcdCanvas.svelte";

    export let pixelSize = 2;
    export let autodraw: boolean = true;
    export const draw = () => doDraw();

    let tileMap: Uint8Array = new Uint8Array(32 * 32);
    let posDebug: string = "";
    let tileDebug: string = "";
    let drawBG;

    function drawBGLines(ctx: CanvasRenderingContext2D): void {
        if ($GbDebugInfoStore == undefined) return;
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
        const ly = $GbDebugInfoStore.lcd.lY;
        if (ly < 144) {
            ctx.strokeStyle = "rgba(80, 80, 80, 0.6)";
            ctx.moveTo(minX, minY + ly);
            ctx.lineTo(maxX, minY + ly);
            ctx.stroke();
        }
    }

    function postProcess(ctx: CanvasRenderingContext2D): void {
        tileMap = Debug.GetBGTileMap(tileMap);
        drawBGLines(ctx);
    }

    function onMouseMove(ev: MouseEvent): void {
        if (!$GbDebugInfoStore) return;
        const bufferX = Math.floor(Math.max(0, ev.offsetX) / pixelSize);
        const bufferY = Math.floor(Math.max(0, ev.offsetY) / pixelSize);
        const tileX = Math.floor(bufferX / 8);
        const tileY = Math.floor(bufferY / 8);
        const screenX = bufferX - $GbDebugInfoStore.lcd.scX;
        const screenY = bufferY - $GbDebugInfoStore.lcd.scY;
        const onScreen =
            screenX >= 0 && screenX < 160 && screenY >= 0 && screenY < 144;
        posDebug = onScreen
            ? `screenPos: (${screenX}, ${screenY}) TODO: support wrap`
            : "";
        tileDebug = ` BG (${tileX}, ${tileY}) tileIndex = ${
            tileMap[tileX + tileY * 32]
        }`;
    }

    function doDraw() {
        drawBG();
    }
</script>

<LcdCanvas
    width={32 * 8}
    height={32 * 8}
    updateBuffer={Debug.DrawBackgroundMap}
    {postProcess}
    mouseMove={onMouseMove}
    frameStore={GameFrames}
    bind:draw={drawBG}
    bind:autodraw
    bind:pixelSize
/>
<div class="debugs">
    <span>{posDebug}</span>
    <span>{tileDebug}</span>
</div>

<style>
    .debugs {
        display: flex;
        justify-content: space-between;
        max-width: 30em;
        overflow-x: auto;
    }
</style>
