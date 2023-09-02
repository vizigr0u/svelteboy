<script lang="ts">
  import { onMount } from "svelte";

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let screenData: ImageData;
  let width = 160;
  let height = 144;
  let pixelSize = 3;

  let testIndex: number = 0;

  const key = 0xea3742c76bf95d47;

  onMount(() => {
    context = canvas.getContext("2d");
    screenData = context.createImageData(width, height);
  });
</script>

<canvas
  bind:this={canvas}
  {width}
  {height}
  class="canvas"
  style="width: {width * pixelSize}px; height: {height * pixelSize}px;"
/>
<div class="canvas-controls">
  <input type="range" bind:value={pixelSize} min="1" max="10" />
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
