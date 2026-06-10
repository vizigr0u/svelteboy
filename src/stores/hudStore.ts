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

export function migrateHudConfig(stored: HudConfig): HudConfig {
    const enabled = { ...DEFAULT_HUD.enabled, ...(stored.enabled ?? {}) };
    const position = (['tl', 'tr', 'bl', 'br'] as const).includes(stored.position) ? stored.position : 'tr';
    return { enabled, position };
}

export function applyToggleChip(c: HudConfig, id: HudChipId): HudConfig {
    return { ...c, enabled: { ...c.enabled, [id]: !c.enabled[id] } };
}

export function applySetChip(c: HudConfig, id: HudChipId, on: boolean): HudConfig {
    return { ...c, enabled: { ...c.enabled, [id]: on } };
}

export function applyEnableSpeedrun(c: HudConfig): HudConfig {
    return { ...c, enabled: { ...c.enabled, fps: true, frame: true, input: true } };
}

export const HudStore = MakeIDBStore<HudConfig>('option-hud-config', DEFAULT_HUD, migrateHudConfig);

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
    HudStore.update(c => applyToggleChip(c, id));
}

export function setHudChip(id: HudChipId, on: boolean): void {
    HudStore.update(c => applySetChip(c, id, on));
}

export function setHudPosition(p: HudPosition): void {
    HudStore.update(c => ({ ...c, position: p }));
}

export function enableSpeedrunHud(): void {
    HudStore.update(c => applyEnableSpeedrun(c));
}

export function isHudChipEnabled(id: HudChipId): boolean {
    return get(HudStore).enabled[id];
}
