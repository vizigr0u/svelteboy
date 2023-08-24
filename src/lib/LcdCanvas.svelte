<script lang="ts">
  import { onMount } from "svelte";
  import { GameFrames } from "../stores/playStores";

  export let width: number = 42;
  export let height: number = 42;
  export let updateBuffer: (a: Uint8ClampedArray) => Uint8ClampedArray = (a) =>
    a;
  export let postProcess: (ctx: CanvasRenderingContext2D) => void = undefined;
  export let mouseMove: (ev: MouseEvent) => void = undefined;
  export let pixelSize = 2;
  export let autodraw: boolean = true;
  export const draw = () => drawToCanvas();
  export let showPerfReport: boolean = true;

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let screenData: ImageData;

  let timeSpentDrawing: number = 0;
  let drawCounts: number = 0;
  let timeReport: string;
  let postProcessTime: number = 0;

  GameFrames.subscribe((frame) => {
    if (autodraw) {
      if (frame != -1) {
        drawToCanvas();
        drawCounts++;
        if (timeSpentDrawing > 0) {
          timeReport = (timeSpentDrawing / drawCounts).toFixed(1);
          if (postProcess) {
            timeReport += " postProcess: " + postProcessTime.toFixed(1);
          }
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
      const other = updateBuffer(data);
      timeSpentDrawing += performance.now() - t0;
      if (other) {
        context.putImageData(new ImageData(other, width, height), 0, 0);
      }
      if (postProcess) {
        const t1 = performance.now();
        postProcess(context);
        postProcessTime = performance.now() - t1;
      }
    }
  }

  function onMouseMove(ev: MouseEvent) {
    if (mouseMove) mouseMove(ev);
  }
</script>

<div class="tile-data-canvas">
  <div class="tile-data-title">
    {#if showPerfReport && timeReport}
      <span>Draw time: {timeReport}ms</span>
    {/if}
  </div>
  <div class="tile-data-canvas-container">
    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
    <canvas
      on:mousemove={onMouseMove}
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
