<script lang="ts">
  import { onMount } from "svelte";
  import type { GBPalette } from "../stores/optionsStore";
  import { PALETTE_PRESETS } from "../stores/optionsStore";

  const W = 160, H = 144;
  let { pixelSize = 3, palette = PALETTE_PRESETS[0] }: { pixelSize?: number; palette?: GBPalette } = $props();

  let canvas: HTMLCanvasElement;
  let gl: WebGL2RenderingContext | null = null;
  let dmgProg: WebGLProgram | null = null;
  let cgbProg: WebGLProgram | null = null;
  let dmgTexture: WebGLTexture | null = null;
  let cgbTexture: WebGLTexture | null = null;
  let paletteLoc: WebGLUniformLocation | null = null;
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

  const dmgFragSrc = `#version 300 es
precision mediump float;
uniform highp usampler2D uFrame;
uniform vec4 uPalette[4];
in vec2 vUV;
out vec4 fragColor;
void main() {
  int px = int(vUV.x * ${W}.0);
  int py = int(vUV.y * ${H}.0);
  uint idx = texelFetch(uFrame, ivec2(px, py), 0).r;
  fragColor = uPalette[idx];
}`;

  const cgbFragSrc = `#version 300 es
precision mediump float;
uniform highp usampler2D uFrame;
in vec2 vUV;
out vec4 fragColor;
void main() {
  int px = int(vUV.x * ${W}.0);
  int py = int(vUV.y * ${H}.0);
  uint rgb = texelFetch(uFrame, ivec2(px, py), 0).r;
  float r = float(rgb & 31u) / 31.0;
  float g = float((rgb >> 5u) & 31u) / 31.0;
  float b = float((rgb >> 10u) & 31u) / 31.0;
  fragColor = vec4(r, g, b, 1.0);
}`;

  function compileShader(type: number, src: string): WebGLShader {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS))
      throw new Error(gl!.getShaderInfoLog(sh) ?? "shader compile error");
    return sh;
  }

  function makeProgram(vert: WebGLShader, frag: WebGLShader): WebGLProgram {
    const prog = gl!.createProgram()!;
    gl!.attachShader(prog, vert);
    gl!.attachShader(prog, frag);
    gl!.linkProgram(prog);
    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS))
      throw new Error(gl!.getProgramInfoLog(prog) ?? "shader link error");
    return prog;
  }

  function abgrToFloats(colors: GBPalette): Float32Array {
    const f = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      const c = colors[i];
      f[i * 4 + 0] = (c & 0xff) / 255;
      f[i * 4 + 1] = ((c >> 8) & 0xff) / 255;
      f[i * 4 + 2] = ((c >> 16) & 0xff) / 255;
      f[i * 4 + 3] = ((c >>> 24) & 0xff) / 255;
    }
    return f;
  }

  function makeTexture(internalFormat: number, type: number): WebGLTexture {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, internalFormat, W, H, 0, gl!.RED_INTEGER, type, null);
    return tex;
  }

  onMount(() => {
    gl = canvas.getContext("webgl2");
    if (!gl) return;

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const vert = compileShader(gl.VERTEX_SHADER, vertSrc);

    dmgProg = makeProgram(vert, compileShader(gl.FRAGMENT_SHADER, dmgFragSrc));
    gl.useProgram(dmgProg);
    gl.uniform1i(gl.getUniformLocation(dmgProg, "uFrame"), 0);
    paletteLoc = gl.getUniformLocation(dmgProg, "uPalette");
    gl.uniform4fv(paletteLoc, abgrToFloats(palette));
    dmgTexture = makeTexture(gl.R8UI, gl.UNSIGNED_BYTE);

    cgbProg = makeProgram(vert, compileShader(gl.FRAGMENT_SHADER, cgbFragSrc));
    gl.useProgram(cgbProg);
    gl.uniform1i(gl.getUniformLocation(cgbProg, "uFrame"), 0);
    cgbTexture = makeTexture(gl.R16UI, gl.UNSIGNED_SHORT);

    ready = true;
  });

  $effect(() => {
    if (gl && dmgProg && paletteLoc !== null) {
      gl.useProgram(dmgProg);
      gl.uniform4fv(paletteLoc, abgrToFloats(palette));
    }
  });

  export function draw(frame: Uint8Array | Uint16Array): void {
    if (!gl || !ready) return;

    const isCgb = frame instanceof Uint16Array;
    gl.useProgram(isCgb ? cgbProg : dmgProg);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, isCgb ? cgbTexture : dmgTexture);

    if (isCgb) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED_INTEGER, gl.UNSIGNED_SHORT, frame as Uint16Array);
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED_INTEGER, gl.UNSIGNED_BYTE, frame as Uint8Array);
    }

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
