<script lang="ts">
  import { onMount } from "svelte";
  import {
    getGameboyTileExampleData,
    getPokemonTileExampleData,
    getLetterTileExampleData,
    getTestExampleData,
    drawVideoBuffercontent,
  } from "../../../build/release";

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let screenData: ImageData;
  let width = 160;
  let height = 144;
  let pixelSize = 2;

  const key = 0xea3742c76bf95d47;

  onMount(() => {
    context = canvas.getContext("2d");
    screenData = context.createImageData(width, height);
  });

  function drawTestScreen() {
    if (screenData != undefined) {
      const data = screenData.data;
      const other = drawVideoBuffercontent(data, 160);
      context.putImageData(new ImageData(other, width), 0, 0);
    }
  }

  function onClick(e: MouseEvent) {
    drawTestScreen();
  }
</script>

<div class="debug-canvas">
  <canvas
    bind:this={canvas}
    {width}
    {height}
    class="canvas"
    style="width: {width * pixelSize}px; height: {height * pixelSize}px;"
  />
  <div class="canvas-controls">
    <button on:click={onClick}>Test sprite display</button>
    <input type="range" bind:value={pixelSize} min="1" max="10" />
  </div>
</div>

<style>
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
</style>
