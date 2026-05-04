/**
 * Largest integer scale that fits the canvas inside the given container.
 * Always >= 1 — never returns 0 even when the container is smaller than base.
 */
export function pixelPerfectScale(
    containerW: number,
    containerH: number,
    baseW = 160,
    baseH = 144,
): number {
    const sx = Math.floor(containerW / baseW);
    const sy = Math.floor(containerH / baseH);
    return Math.max(1, Math.min(sx, sy));
}
