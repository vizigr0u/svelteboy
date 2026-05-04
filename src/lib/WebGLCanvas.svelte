<script lang="ts">
  import { onMount } from "svelte";
  import type { GBPalette, CgbColorMode } from "../stores/optionsStore";
  import { PALETTE_PRESETS } from "../stores/optionsStore";
  import { CGB_COLOR_CURVE_GLSL } from "./shaders/colorCurve";
  import { CGB_SUBPIXEL_GLSL } from "./shaders/cgbSubpixel";
  import { pixelPerfectScale } from "./shaders/pixelPerfect";

  const W = 160, H = 144;
  // Backing buffer locked at integer multiple of native — high enough for
  // shader subpixel pattern detail. CSS scales display to fit parent.
  const RENDER_SCALE = 3;
  let {
    palette = PALETTE_PRESETS[0],
    cgbColor = 'none',
    ghostingStrength = 0,
    pixelPerfect = true,
  }: {
    palette?: GBPalette;
    cgbColor?: CgbColorMode;
    ghostingStrength?: number;
    pixelPerfect?: boolean;
  } = $props();

  let canvas: HTMLCanvasElement;
  let wrapper: HTMLDivElement;
  let gl: WebGL2RenderingContext | null = null;

  // Pass A — frame upload programs
  let dmgProg: WebGLProgram | null = null;
  let cgbProg: WebGLProgram | null = null;
  let dmgFrameTex: WebGLTexture | null = null;
  let cgbFrameTex: WebGLTexture | null = null;
  let paletteLoc: WebGLUniformLocation | null = null;

  // Pass B — composite program + uniforms
  let compositeProg: WebGLProgram | null = null;
  let uCurrLoc: WebGLUniformLocation | null = null;
  let uPrevLoc: WebGLUniformLocation | null = null;
  let uGridLoc: WebGLUniformLocation | null = null;
  let uGhostLoc: WebGLUniformLocation | null = null;
  let uLutLoc: WebGLUniformLocation | null = null;
  let uModeLoc: WebGLUniformLocation | null = null;

  // Ping-pong FBOs (RGBA8 @ 160×144). currentFbo holds last rendered frame; prevFbo lags by one frame.
  let fboCurr: WebGLFramebuffer | null = null;
  let texCurr: WebGLTexture | null = null;
  let fboPrev: WebGLFramebuffer | null = null;
  let texPrev: WebGLTexture | null = null;

  let ready = false;
  let lastIsCgb = false;
  let hasFrame = false;

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

  // Pass A: write palette/RGB555 → RGBA8 FBO (no scaling)
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

  // Pass B: composite — ghost + (CGB subpixel | DMG RGB stripe) + optional LUT
  // uMode: 0 = DMG (palette stripe + optional LUT), 1 = CGB (subpixel; LUT implicit)
  const compositeFragSrc = `#version 300 es
precision mediump float;
uniform sampler2D uCurr;
uniform sampler2D uPrev;
uniform float uGrid;
uniform float uGhost;
uniform float uLut;
uniform int uMode;
in vec2 vUV;
out vec4 fragColor;

${CGB_COLOR_CURVE_GLSL}
${CGB_SUBPIXEL_GLSL}

void main() {
  // Pass A wrote into FBOs with the same UV flip that maps the source frame
  // (top-down byte layout) onto a GL texture (bottom-up). Re-flip Y here
  // so this sampling matches what direct-to-canvas rendering produced.
  vec2 fUV = vec2(vUV.x, 1.0 - vUV.y);
  vec2 srcSize = vec2(${W}.0, ${H}.0);
  ivec2 ipx = ivec2(fUV * srcSize);

  vec3 col  = texelFetch(uCurr, ipx, 0).rgb;
  vec3 prev = texelFetch(uPrev, ipx, 0).rgb;
  col = mix(col, prev, uGhost);

  // CGB-only: subpixel or LUT. DMG mode passes through untouched (ghost only).
  if (uMode == 1) {
    if (uGrid > 0.0) {
      vec3 sp = cgbSubpixel(uCurr, fUV, srcSize);
      col = mix(col, sp, uGrid);
    } else if (uLut > 0.5) {
      col = applyCurve(col);
    }
  }

  fragColor = vec4(col, 1.0);
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

  function makeIntegerTexture(internalFormat: number, type: number): WebGLTexture {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, internalFormat, W, H, 0, gl!.RED_INTEGER, type, null);
    return tex;
  }

  function makeRgbaFbo(w: number = W, h: number = H, filter: number = 0): { fbo: WebGLFramebuffer; tex: WebGLTexture } {
    const f = filter || gl!.NEAREST;
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, f);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, f);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
    if (gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) !== gl!.FRAMEBUFFER_COMPLETE)
      throw new Error("FBO incomplete");
    return { fbo, tex };
  }

  function recomputeDisplaySize() {
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    if (!cw || !ch) return;
    let cssW: number, cssH: number;
    if (pixelPerfect) {
      const scale = pixelPerfectScale(cw, ch);
      cssW = W * scale;
      cssH = H * scale;
    } else {
      const ratio = W / H;
      if (cw / ch > ratio) {
        cssH = ch;
        cssW = ch * ratio;
      } else {
        cssW = cw;
        cssH = cw / ratio;
      }
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    if (ready && hasFrame) composite();
  }

  onMount(() => {
    gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
    if (!gl) return;

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const vert = compileShader(gl.VERTEX_SHADER, vertSrc);

    dmgProg = makeProgram(vert, compileShader(gl.FRAGMENT_SHADER, dmgFragSrc));
    gl.useProgram(dmgProg);
    gl.uniform1i(gl.getUniformLocation(dmgProg, "uFrame"), 0);
    paletteLoc = gl.getUniformLocation(dmgProg, "uPalette");
    gl.uniform4fv(paletteLoc, abgrToFloats(palette));
    dmgFrameTex = makeIntegerTexture(gl.R8UI, gl.UNSIGNED_BYTE);

    cgbProg = makeProgram(vert, compileShader(gl.FRAGMENT_SHADER, cgbFragSrc));
    gl.useProgram(cgbProg);
    gl.uniform1i(gl.getUniformLocation(cgbProg, "uFrame"), 0);
    cgbFrameTex = makeIntegerTexture(gl.R16UI, gl.UNSIGNED_SHORT);

    compositeProg = makeProgram(vert, compileShader(gl.FRAGMENT_SHADER, compositeFragSrc));
    gl.useProgram(compositeProg);
    uCurrLoc = gl.getUniformLocation(compositeProg, "uCurr");
    uPrevLoc = gl.getUniformLocation(compositeProg, "uPrev");
    uGridLoc = gl.getUniformLocation(compositeProg, "uGrid");
    uGhostLoc = gl.getUniformLocation(compositeProg, "uGhost");
    uLutLoc = gl.getUniformLocation(compositeProg, "uLut");
    uModeLoc = gl.getUniformLocation(compositeProg, "uMode");
    gl.uniform1i(uCurrLoc, 0);
    gl.uniform1i(uPrevLoc, 1);

    const a = makeRgbaFbo(); fboCurr = a.fbo; texCurr = a.tex;
    const b = makeRgbaFbo(); fboPrev = b.fbo; texPrev = b.tex;

    canvas.width = W * RENDER_SCALE;
    canvas.height = H * RENDER_SCALE;
    recomputeDisplaySize();
    const ro = new ResizeObserver(() => recomputeDisplaySize());
    if (wrapper) ro.observe(wrapper);
    window.addEventListener("resize", recomputeDisplaySize);
    document.addEventListener("fullscreenchange", recomputeDisplaySize);

    ready = true;

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputeDisplaySize);
      document.removeEventListener("fullscreenchange", recomputeDisplaySize);
    };
  });

  $effect(() => {
    if (gl && dmgProg && paletteLoc !== null) {
      gl.useProgram(dmgProg);
      gl.uniform4fv(paletteLoc, abgrToFloats(palette));
    }
  });

  $effect(() => {
    pixelPerfect;
    if (ready) {
      recomputeDisplaySize();
      composite();
    }
  });

  $effect(() => {
    cgbColor; ghostingStrength;
    if (ready) composite();
  });

  function swapFbos() {
    const tf = fboCurr, tt = texCurr;
    fboCurr = fboPrev; texCurr = texPrev;
    fboPrev = tf; texPrev = tt;
  }

  function composite(): void {
    if (!gl || !ready || !hasFrame) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(compositeProg);
    gl.uniform1f(uGridLoc, cgbColor === 'subpixel' ? 1 : 0);
    gl.uniform1f(uGhostLoc, ghostingStrength);
    gl.uniform1f(uLutLoc, cgbColor === 'lut' ? 1 : 0);
    gl.uniform1i(uModeLoc, lastIsCgb ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texCurr);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texPrev);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  export function draw(frame: Uint8Array | Uint16Array): void {
    if (!gl || !ready) return;

    swapFbos();

    // Pass A — render frame into fboCurr (texture 160×144 RGBA)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboCurr);
    gl.viewport(0, 0, W, H);

    const isCgb = frame instanceof Uint16Array;
    gl.useProgram(isCgb ? cgbProg : dmgProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, isCgb ? cgbFrameTex : dmgFrameTex);
    if (isCgb) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED_INTEGER, gl.UNSIGNED_SHORT, frame as Uint16Array);
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED_INTEGER, gl.UNSIGNED_BYTE, frame as Uint8Array);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    lastIsCgb = isCgb;
    hasFrame = true;
    composite();
  }

  export function isSupported(): boolean {
    return gl !== null;
  }

  export function getCanvas(): HTMLCanvasElement {
    return canvas;
  }
</script>

<div bind:this={wrapper} class="wrapper">
  <canvas bind:this={canvas} class="canvas"></canvas>
</div>

<style>
  .wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  .canvas {
    display: block;
    background-color: rgb(0, 0, 0);
    border: 1px solid black;
    image-rendering: auto;
  }
</style>
