/**
 * Synthetic CGB-to-LCD color curve (Gambatte "agb" matrix).
 * Each row sums to 32/32 → grayscale and white preserved.
 * Saturated channels desaturate toward authentic CGB LCD look.
 */
const M = [
    [26, 4, 2],
    [0, 24, 8],
    [6, 4, 22],
] as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function applyCgbColorCurve(r: number, g: number, b: number): [number, number, number] {
    const rOut = (M[0][0] * r + M[0][1] * g + M[0][2] * b) / 32;
    const gOut = (M[1][0] * r + M[1][1] * g + M[1][2] * b) / 32;
    const bOut = (M[2][0] * r + M[2][1] * g + M[2][2] * b) / 32;
    return [clamp01(rOut), clamp01(gOut), clamp01(bOut)];
}

/**
 * GLSL fragment of equivalent matrix, callable as `applyCurve(vec3)`.
 * Kept in lockstep with the JS reference above so tests cover the math.
 */
export const CGB_COLOR_CURVE_GLSL = `
vec3 applyCurve(vec3 c) {
  float r = (26.0 * c.r +  4.0 * c.g +  2.0 * c.b) / 32.0;
  float g = (             24.0 * c.g +  8.0 * c.b) / 32.0;
  float b = ( 6.0 * c.r +  4.0 * c.g + 22.0 * c.b) / 32.0;
  return clamp(vec3(r, g, b), 0.0, 1.0);
}
`;
