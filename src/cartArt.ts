import { getGbNames, getGbcNames } from "./cartridgeNames";
import type { LibraryRom } from "./types";

const ART_DIR = import.meta.env.DEV
    ? "/libretro-art/"
    : "https://thumbnails.libretro.com/";
const GB_ART_DIR = ART_DIR + "Nintendo%20-%20Game%20Boy/Named_Boxarts/";
const GBC_ART_DIR = ART_DIR + "Nintendo%20-%20Game%20Boy%20Color/Named_Boxarts/";

export const DEFAULT_THUMB_SRC = "./UnknownGame.png";
export const DEFAULT_THUMB_ALT = "Unknown game art";

export type RomArt = { src: string; alt: string };

export async function resolveRomArt(rom: LibraryRom): Promise<RomArt> {
    try {
        const isGbc = rom.name.endsWith(".gbc");
        const names = await (isGbc ? getGbcNames() : getGbNames());
        const sha1Upper = rom.sha1.toUpperCase();
        if (sha1Upper in names) {
            const alt = names[sha1Upper];
            return { src: (isGbc ? GBC_ART_DIR : GB_ART_DIR) + alt + ".png", alt };
        }
    } catch (_) { /* fall through */ }
    return { src: DEFAULT_THUMB_SRC, alt: DEFAULT_THUMB_ALT };
}

export function onThumbErr(e: Event): void {
    const img = e.target as HTMLImageElement;
    img.src = DEFAULT_THUMB_SRC;
    img.alt = DEFAULT_THUMB_ALT;
    img.onerror = null;
}
