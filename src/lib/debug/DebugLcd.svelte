<script lang="ts">
  import { onMount } from "svelte";
  import { drawVideoBuffercontent } from "../../../build/release";
  import { frameCount } from "../../stores/debugStores";

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let screenData: ImageData;
  const tileSize = 8;
  const width = 32 * tileSize;
  const height = 8 * tileSize;
  let pixelSize = 2;
  let autodraw: boolean = true;

  let frameNumber: number = 0;
  let timeSpentDrawing: number = 0;
  let drawCounts: number = 0;
  let lastDrawTime: number = 0;
  let lastDraw10Time: number = 0;
  let last10FPS: number = 0;
  let fpsReport: string;

  frameCount.subscribe((frame) => {
    if (frame != -1) {
      drawTestScreen();
      const drawEndTime = performance.now();
      drawCounts++;
      if (frame % 10 == 0 && frame > 0) {
        if (lastDraw10Time > 0) {
          last10FPS = 10000 / (drawEndTime - lastDraw10Time);
        }
        lastDraw10Time = drawEndTime;
      }
      if (lastDrawTime > 0) {
        fpsReport = (1000 / (drawEndTime - lastDrawTime)).toFixed(1) + " FPS";
        if (lastDraw10Time > 0)
          fpsReport +=
            " (" +
            last10FPS.toFixed(1) +
            " rolling) avg draw: " +
            (timeSpentDrawing / drawCounts).toFixed(1) +
            " ms";
      }
      lastDrawTime = drawEndTime;
    } else {
      drawCounts = 0;
    }
    frameNumber = frame;
  });

  onMount(() => {
    context = canvas.getContext("2d");
    screenData = context.createImageData(width, height);
  });

  function drawTestScreen() {
    if (screenData != undefined) {
      const data = screenData.data;
      const t0 = performance.now();
      const other = drawVideoBuffercontent(data, width);
      timeSpentDrawing += performance.now() - t0;
      context.putImageData(new ImageData(other, width), 0, 0);
    }
  }

  function onClick() {
    drawTestScreen();
  }
</script>

<div class="tile-data-canvas">
  <div class="tile-data-title">
    <h3>Tile Data</h3>
    {#if fpsReport}
      <span>{fpsReport}</span>
    {/if}
  </div>
  <div class="canvas-controls">
    <label>
      auto-draw
      <input type="checkbox" bind:checked={autodraw} />
    </label>
    <button on:click={onClick}>Draw now</button>
    <input type="range" bind:value={pixelSize} min="1" max="10" />
  </div>
  <div class="tile-data-canvas-container">
    <canvas
      bind:this={canvas}
      {width}
      {height}
      class="canvas"
      style="width: {width * pixelSize}px; height: {height * pixelSize}px;"
    />
  </div>
</div>

<style>
  .tile-data-title {
    display: flex;
    align-items: center;
    justify-content: space-around;
  }
  .tile-data-canvas {
    display: flex;
    flex-direction: column;
  }
  .canvas {
    background-color: rgb(0, 0, 0);
    border: 1px solid black;

    image-rendering: optimizeSpeed; /* Older versions of FF          */
    image-rendering: -moz-crisp-edges; /* FF 6.0+                       */
    image-rendering: -webkit-optimize-contrast; /* Safari                        */
    image-rendering: -o-crisp-edges; /* OS X & Windows Opera (12.02+) */
    image-rendering: pixelated; /* Awesome future-browsers       */
    -ms-interpolation-mode: nearest-neighbor; /* IE                            */
  }

  .canvas-controls {
    display: flex;
    justify-content: left;
    align-items: center;
    gap: 1em;
    /* width: 35em; */
  }
</style>
