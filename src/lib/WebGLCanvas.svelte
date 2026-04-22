<script lang="ts">
  import { onMount } from "svelte";

  const W = 160, H = 144;
  let { pixelSize = 3 } = $props<{ pixelSize?: number }>();

  let canvas: HTMLCanvasElement;
  let gl: WebGL2RenderingContext | null = null;
  let frameTexture: WebGLTexture | null = null;
  let ready = false;

  const vertSrc = `#version 300 es
const vec2 POS[6] = vec2[6](
  vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0, 1.0),
  vec2(-1.0, 1.0), vec2(1.0,-1.0), vec2( 1.0, 1.0)
);
const vec2 UV[6] = vec2[6](
  vec2(0.0,1.0), vec2(1.0,1.0), vec2(0.0,0.0),
  vec2(0.0,0.0), vec2(1.0,1.0), vec2(1.0,0.0)
);
out vec2 vUV;
void main() {
  gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0);
  vUV = UV[gl_VertexID];
}`;

  const fragSrc = `#version 300 es
precision mediump float;
uniform highp usampler2D uFrame;
const vec4 PALETTE[4] = vec4[4](
  vec4(0.878, 0.992, 0.812, 1.0),
  vec4(0.537, 0.753, 0.435, 1.0),
  vec4(0.204, 0.408, 0.337, 1.0),
  vec4(0.0,   0.0,   0.0,   1.0)
);
in vec2 vUV;
out vec4 fragColor;
void main() {
  int px = int(vUV.x * ${W}.0);
  int py = int(vUV.y * ${H}.0);
  uint idx = texelFetch(uFrame, ivec2(px, py), 0).r;
  fragColor = PALETTE[idx];
}`;

  function compileShader(type: number, src: string): WebGLShader {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS))
      throw new Error(gl!.getShaderInfoLog(sh) ?? "shader compile error");
    return sh;
  }

  onMount(() => {
    gl = canvas.getContext("webgl2");
    if (!gl) return;

    const vert = compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = compileShader(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) ?? "shader link error");
    gl.useProgram(prog);

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    gl.uniform1i(gl.getUniformLocation(prog, "uFrame"), 0);

    frameTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, W, H, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null);

    ready = true;
  });

  export function draw(frame: Uint8Array): void {
    if (!gl || !ready) return;

    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED_INTEGER, gl.UNSIGNED_BYTE, frame);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  export function isSupported(): boolean {
    return gl !== null;
  }
</script>

<canvas
  bind:this={canvas}
  width={W * pixelSize}
  height={H * pixelSize}
  class="canvas"
></canvas>

<style>
  .canvas {
    display: block;
    background-color: rgb(0, 0, 0);
    border: 1px solid black;
  }
</style>
