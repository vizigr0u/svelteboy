import { get } from "svelte/store";
import { Emulator } from "./emulator";
import { loadedCartridge, loadedBootRom } from "stores/romStores";
import { PALETTE_PRESETS, SelectedPaletteIndex } from "stores/optionsStore";

const W = 160, H = 144;

function frameToImageData(): ImageData | null {
    const data = new Uint8ClampedArray(W * H * 4);
    if (Emulator.IsCgbMode()) {
        const frame = Emulator.GetCGBGameFrame();
        for (let i = 0; i < W * H; i++) {
            const rgb = frame[i];
            const r5 = rgb & 0x1f;
            const g5 = (rgb >> 5) & 0x1f;
            const b5 = (rgb >> 10) & 0x1f;
            data[i * 4 + 0] = (r5 * 255) / 31 | 0;
            data[i * 4 + 1] = (g5 * 255) / 31 | 0;
            data[i * 4 + 2] = (b5 * 255) / 31 | 0;
            data[i * 4 + 3] = 0xff;
        }
    } else {
        const frame = Emulator.GetGameFrame();
        const palette = PALETTE_PRESETS[get(SelectedPaletteIndex)];
        for (let i = 0; i < W * H; i++) {
            const c = palette[frame[i] & 3];
            data[i * 4 + 0] = c & 0xff;
            data[i * 4 + 1] = (c >> 8) & 0xff;
            data[i * 4 + 2] = (c >> 16) & 0xff;
            data[i * 4 + 3] = (c >>> 24) & 0xff;
        }
    }
    return new ImageData(data, W, H);
}

function sanitize(name: string): string {
    return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'screenshot';
}

function timestamp(): string {
    const d = new Date();
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export function takeScreenshot(): void {
    const cart = get(loadedCartridge);
    const boot = get(loadedBootRom);
    if (!cart && !boot) return;
    const img = frameToImageData();
    if (!img) return;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(img, 0, 0);

    const baseName = sanitize(cart?.name ?? boot?.name ?? 'screenshot');
    const filename = `${baseName}_${timestamp()}.png`;

    canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }, 'image/png');
}
