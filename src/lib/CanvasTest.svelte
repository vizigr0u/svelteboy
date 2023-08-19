<script lang="ts">
  import { onMount } from "svelte";
  import { lch2rgb, hsl2rgb } from "@csstools/convert-colors";

  // export let attributes: CanvasRenderingContext2D = {};

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let width: number = 160;
  let height = 144;
  let pixelSize = 3;
  let time = 0;
  let frame;
  let buffer: ImageData = undefined;
  let counter = 1;
  let a = 1;

  const key = 0xea3742c76bf95d47;

  onMount(() => {
    context = canvas.getContext("2d");
    buffer = context.getImageData(0, 0, canvas.width, canvas.height);
    draw();

    // let frame = requestAnimationFrame(loop);
    function loop(t) {
      frame = requestAnimationFrame(loop);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      console.log(`imageData size: ${imageData.width} ${imageData.height}`);

      for (let p = 0; p < imageData.data.length; p += 4) {
        const i = p / 4;
        const x = i % canvas.width;
        const y = (i / canvas.width) >>> 0;

        const r = 64 + (128 * x) / canvas.width + 64 * Math.sin(t / 1000);
        const g = 64 + (128 * y) / canvas.height + 64 * Math.cos(t / 1000);
        const b = 128;

        imageData.data[p + 0] = Math.round(r / 8) * 8;
        imageData.data[p + 1] = Math.round(g / 8) * 8;
        imageData.data[p + 2] = Math.round(b / 8) * 8;
        imageData.data[p + 3] = 255;
      }

      context.putImageData(imageData, 0, 0);
    }

    return () => {
      cancelAnimationFrame(frame);
    };
  });

  // function render(dt) {
  //   context.save();
  //   context.scale(4, 4);
  //   let data = context.getImageData(0, 0, canvas.width, canvas.height);
  //   data.data[0] = 255;
  //   data.data[1] = 128;
  //   data.data[2] = 0;
  //   data.data[3] = 255;
  //   context.restore();
  // }

  // function createLoop(fn) {
  //   let elapsed = 0;
  //   let lastTime = performance.now();
  //   (function loop() {
  //     frame = requestAnimationFrame(loop);
  //     const beginTime = performance.now();
  //     const dt = (beginTime - lastTime) / 1000;
  //     lastTime = beginTime;
  //     elapsed += dt;
  //     fn(elapsed, dt);
  //   })();
  //   return () => {
  //     cancelAnimationFrame(frame);
  //   };
  // }

  function squares(n: number): number {
    let x: number;
    let y: number;
    let z: number;
    let t: number;

    y = x = ((n >>> 0) * key) >>> 0;
    z = (y + key) >>> 0;

    x = (x * x + y) >>> 0;
    x = (x >> 32) | (x << 32); /* round 1 */

    x = (x * x + z) >>> 0;
    x = (x >> 32) | (x << 32); /* round 2 */

    x = (x * x + y) >>> 0;
    x = (x >> 32) | (x << 32); /* round 3 */

    t = x = (x * x + z) >>> 0;
    x = (x >> 32) | (x << 32); /* round 4 */

    return t ^ (((x * x + y) >>> 0) >> 32); /* round 5 */
  }

  function draw() {
    // console.log(JSON.stringify(arr));

    // for (let i = 0; i < 50; i++) {
    //   console.log(`${squares(i) >>> 0} ${(squares(i) >>> 0).toString(2)}`);
    // }
    if (buffer != undefined) {
      const myCssColor = "lch(20% 8.5 220.0)";
      console.log(Math.abs(squares(counter)) & 0xff);

      for (let p = 0; p < buffer.data.length; p += 4) {
        const i = p / 4;
        const x = i % canvas.width;
        const y = (i / canvas.width) >>> 0;
        let arr = lch2rgb(
          a /*54.29*/,
          /*Math.random() * 256 - 128 */ /* 106.84 */ (255 * x) / width - 128,
          /*Math.random() * 256 - 128*/ /*40.85*/ (255 * y) / height - 128
        );
        // arr = hsl2rgb(
        //   a /*54.29*/,
        //   /*Math.random() * 256 - 128 */ /* 106.84 */ (100 * x) / width,
        //   /*Math.random() * 256 - 128*/ /*40.85*/ (100 * y) / height
        // );
        // arr = hsl2rgb(Math.random() * 360, 50, 50);
        buffer.data[p + 0] = Math.round(arr[0] * 2.55);
        buffer.data[p + 1] = Math.round(arr[1] * 2.55);
        buffer.data[p + 2] = Math.round(arr[2] * 2.55);
        buffer.data[p + 3] = 255;

        // let color = Math.floor(Math.random() * 0x1000000);
        // buffer.data[p + 0] = color & 255;
        // color = color >> 8;
        // buffer.data[p + 1] = color & 255;
        // color = color >> 8;
        // buffer.data[p + 2] = color & 255;
        // buffer.data[p + 3] = 255;
      }
      context.putImageData(buffer, 0, 0);
      counter++;
    }
  }

  function onClick(e: MouseEvent) {
    console.log("click");
    draw();
  }
</script>

<canvas
  bind:this={canvas}
  {width}
  {height}
  class="canvas"
  style="width: {width * pixelSize}px; height: {height * pixelSize}px;"
/>

<input type="range" bind:value={a} min="-128" max="127" on:input={draw} />
<button on:click={onClick}>Click</button>

<style>
  .canvas {
    background-color: white;
    border: 1px solid black;

    image-rendering: optimizeSpeed; /* Older versions of FF          */
    image-rendering: -moz-crisp-edges; /* FF 6.0+                       */
    image-rendering: -webkit-optimize-contrast; /* Safari                        */
    image-rendering: -o-crisp-edges; /* OS X & Windows Opera (12.02+) */
    image-rendering: pixelated; /* Awesome future-browsers       */
    -ms-interpolation-mode: nearest-neighbor; /* IE                            */
  }
</style>
