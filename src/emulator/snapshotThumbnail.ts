import type { GBPalette } from "stores/optionsStore";

function encodeThumbnail(data: Uint8ClampedArray): string {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 144;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(160, 144);
    imageData.data.set(data);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/webp', 0.7);
}

export function captureFrameThumbnail(frame: Uint8Array, palette: GBPalette): string {
    const data = new Uint8ClampedArray(160 * 144 * 4);
    for (let i = 0; i < 160 * 144; i++) {
        const c = palette[frame[i] & 3];
        data[i * 4 + 0] = c & 0xff;
        data[i * 4 + 1] = (c >> 8) & 0xff;
        data[i * 4 + 2] = (c >> 16) & 0xff;
        data[i * 4 + 3] = 255;
    }
    return encodeThumbnail(data);
}

export function captureCgbFrameThumbnail(frame: Uint16Array): string {
    const data = new Uint8ClampedArray(160 * 144 * 4);
    for (let i = 0; i < 160 * 144; i++) {
        const rgb = frame[i];
        data[i * 4 + 0] = ((rgb & 31) * 255 / 31) | 0;
        data[i * 4 + 1] = (((rgb >> 5) & 31) * 255 / 31) | 0;
        data[i * 4 + 2] = (((rgb >> 10) & 31) * 255 / 31) | 0;
        data[i * 4 + 3] = 255;
    }
    return encodeThumbnail(data);
}
