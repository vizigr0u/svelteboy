<script lang="ts">
  import { onMount } from "svelte";

  export let width: number = 42;
  export let height: number = 42;
  export let pixelSize = 2;

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let screenData: ImageData;
  let initialized: boolean = false;

  onMount(() => {
    context = canvas.getContext("2d");
    screenData = context.createImageData(width, height);
    initialized = true;
  });

  export function draw(buffer: Uint8ClampedArray) {
    context.putImageData(new ImageData(buffer, width, height), 0, 0);
  }
</script>

<div class="tile-data-canvas">
  <div class="tile-data-canvas-container">
    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
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
  .tile-data-canvas {
    display: flex;
    flex-direction: column;
    align-items: center;
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
</style>
