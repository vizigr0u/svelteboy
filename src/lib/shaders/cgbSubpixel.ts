/**
 * CGB subpixel LCD simulation (GBCC-style).
 *
 * Each source pixel is rendered as four semicircle subpixels at normalised
 * x = 0, 2/7, 4/7, 1.0 with radius 2/7. The leftmost/rightmost reds belong
 * to neighbouring pixels (bleed). Multiplying by physical GBC primaries
 * does colour correction implicitly — no LUT needed.
 *
 * Primaries:
 *   R = #FF7145, G = #C1D650, B = #3BCEFF
 *
 * Vertical edge fade (EDGE) gives soft horizontal grid lines.
 */
export const CGB_SUBPIXEL_GLSL = `
const vec3 SP_R = vec3(1.0,         113.0/255.0,  69.0/255.0); // #FF7145
const vec3 SP_G = vec3(193.0/255.0, 214.0/255.0,  80.0/255.0); // #C1D650
const vec3 SP_B = vec3( 59.0/255.0, 206.0/255.0,   1.0);       // #3BCEFF

const float SP_R_RADIUS = 2.0 / 7.0;
const float SP_PEAK_INV = 7.0 / 2.0; // 1/radius — normalises peak to 1
const float SP_EDGE     = 0.06;      // vertical fade fraction

float subpixelWeight(float dx) {
  float r2 = SP_R_RADIUS * SP_R_RADIUS;
  return sqrt(max(0.0, r2 - dx * dx)) * SP_PEAK_INV;
}

vec3 cgbSubpixel(sampler2D src, vec2 fUV, vec2 srcSize) {
  vec2 fpx = fUV * srcSize;
  ivec2 ipx = ivec2(fpx);
  vec2 cell = fract(fpx);

  vec3 cur  = texelFetch(src, ipx, 0).rgb;
  vec3 next = texelFetch(src, ivec2(min(ipx.x + 1, int(srcSize.x) - 1), ipx.y), 0).rgb;

  float x = cell.x;
  float wR  = subpixelWeight(x);
  float wG  = subpixelWeight(x - 2.0 / 7.0);
  float wB  = subpixelWeight(x - 4.0 / 7.0);
  float wRn = subpixelWeight(x - 1.0);

  vec3 col =
      (cur.r  * wR  + next.r * wRn) * SP_R +
       cur.g  * wG                  * SP_G +
       cur.b  * wB                  * SP_B;

  float y = cell.y;
  float vfade = smoothstep(0.0, SP_EDGE, y) * (1.0 - smoothstep(1.0 - SP_EDGE, 1.0, y));
  return col * vfade;
}
`;
