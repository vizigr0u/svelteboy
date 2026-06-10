import { get } from "svelte/store";
import { MakeIDBStore } from "./idbStore";

export type HudChipId = 'fps' | 'frame' | 'input' | 'cpu' | 'rewind';
export type HudPosition = 'tl' | 'tr' | 'bl' | 'br';

export type HudConfig = {
    enabled: Record<HudChipId, boolean>;
    position: HudPosition;
};

const DEFAULT_HUD: HudConfig = {
    enabled: { fps: false, frame: false, input: false, cpu: false, rewind: false },
    position: 'tr',
};

function migrate(stored: HudConfig): HudConfig {
    const enabled = { ...DEFAULT_HUD.enabled, ...(stored.enabled ?? {}) };
    const position = (['tl', 'tr', 'bl', 'br'] as const).includes(stored.position) ? stored.position : 'tr';
    return { enabled, position };
}

export const HudStore = MakeIDBStore<HudConfig>('option-hud-config', DEFAULT_HUD, migrate);

export const HUD_CHIP_LABELS: Record<HudChipId, string> = {
    fps: 'FPS',
    frame: 'Frame counter',
    input: 'Input display',
    cpu: 'CPU cycles',
    rewind: 'Rewind buffer',
};

export const HUD_POSITION_LABELS: Record<HudPosition, string> = {
    tl: 'Top-left',
    tr: 'Top-right',
    bl: 'Bottom-left',
    br: 'Bottom-right',
};

export function toggleHudChip(id: HudChipId): void {
    HudStore.update(c => ({ ...c, enabled: { ...c.enabled, [id]: !c.enabled[id] } }));
}

export function setHudChip(id: HudChipId, on: boolean): void {
    HudStore.update(c => ({ ...c, enabled: { ...c.enabled, [id]: on } }));
}

export function setHudPosition(p: HudPosition): void {
    HudStore.update(c => ({ ...c, position: p }));
}

export function enableSpeedrunHud(): void {
    HudStore.update(c => ({ ...c, enabled: { ...c.enabled, fps: true, frame: true, input: true } }));
}

export function isHudChipEnabled(id: HudChipId): boolean {
    return get(HudStore).enabled[id];
}
