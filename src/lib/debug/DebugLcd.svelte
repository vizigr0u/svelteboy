<script lang="ts">
  import { onMount } from "svelte";
  import { GameFrames } from "../../stores/playStores";

  export let width: number = 42;
  export let height: number = 42;
  export let draw: (a: Uint8ClampedArray) => Uint8ClampedArray = (a) => a;
  export let title: string = "LCD Title";

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let screenData: ImageData;
  let pixelSize = 2;
  let autodraw: boolean = true;

  let timeSpentDrawing: number = 0;
  let drawCounts: number = 0;
  let timeReport: string;

  GameFrames.subscribe((frame) => {
    if (autodraw) {
      if (frame != -1) {
        drawToCanvas();
        drawCounts++;
        if (timeSpentDrawing > 0) {
          timeReport = (timeSpentDrawing / drawCounts).toFixed(1);
        }
      } else {
        drawCounts = 0;
      }
    }
  });

  onMount(() => {
    context = canvas.getContext("2d");
    screenData = context.createImageData(width, height);
  });

  function drawToCanvas() {
    if (screenData != undefined) {
      const data = screenData.data;
      const t0 = performance.now();
      const other = draw(data);
      timeSpentDrawing += performance.now() - t0;
      if (other) {
        context.putImageData(new ImageData(other, width, height), 0, 0);
      }
    }
  }

  function onClick() {
    drawToCanvas();
  }
</script>

<div class="tile-data-canvas">
  <div class="tile-data-title">
    {#if title}
      <h3>{title}</h3>
    {/if}
    {#if timeReport}
      <span>Draw time: {timeReport}ms</span>
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
