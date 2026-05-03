import { writable } from "svelte/store";
import { MakeIDBStore as MakeLocalStore } from "./idbStore";
import type { KeyBindings } from "../types";
import { DEFAULT_KEYBINDINGS } from "../keybindPresets";
import type { RenderModeOverride } from "../cartType";

export type GBPalette = readonly [number, number, number, number];

export const PALETTE_PRESETS: readonly GBPalette[] = [
    [0xffcffde0, 0xff6fc089, 0xff566834, 0xff000000],
    [0xffffffff, 0xffaaaaaa, 0xff555555, 0xff000000],
    [0xff9bcfbe, 0xff7ea89b, 0xff567369, 0xff2e3d38],
    [0xff49b0a5, 0xff65ae91, 0xff5ea98c, 0xff578872],
] as const;

export const PALETTE_NAMES = ['Green', 'Black&White', 'Pocket', 'DMG-01'] as const;

export const SelectedPaletteIndex = MakeLocalStore<number>('option-palette-index', 0);

export const useBoot = writable<boolean>(false);
export const playerPixelSize = MakeLocalStore<number>('option-pixel-size', 3);
export const showFPS = MakeLocalStore<boolean>('option-show-fps', false);
export const showFrametimeHistogram = MakeLocalStore<boolean>('option-show-frametime-histogram', false);
export const HideKeyboardWarning = MakeLocalStore<boolean>('option-hide-keyboard-warning', false);
export const DismissSavesWarning = MakeLocalStore<boolean>('option-hide-saves-warning', false);
export const LibraryImportSourceUri = MakeLocalStore<string>('option-library-import-source-uri', "");
export const AutoSaveUriRoms = MakeLocalStore<boolean>('option-auto-save-uri-roms', true);
export type LibrarySortOrder = 'lastPlayed' | 'added' | 'name';
export const LibrarySort = MakeLocalStore<LibrarySortOrder>('option-library-sort', 'lastPlayed');
export type LibrarySourceFilter = 'all' | 'local' | 'remote';
export const LibrarySource = MakeLocalStore<LibrarySourceFilter>('option-library-source-filter', 'all');
export type LibraryTypeFilter = 'all' | 'gb-compat' | 'cgb-only';
export const LibraryTypeFilterStore = MakeLocalStore<LibraryTypeFilter>('option-library-type-filter', 'all');
export const RegularSpeed = MakeLocalStore<number>('option-regular-speed', 1);
export const BurstSpeed = MakeLocalStore<number>('option-emulator-speed', 4);
export const MuteOnFastForward = MakeLocalStore<boolean>('option-mute-on-fast-forward', true);
export const PauseOnVisibilityLost = MakeLocalStore<boolean>('option-pause-on-visibility-lost', true);
// export const AudioBufferSize = writable<number>(512);
export const AudioMasterVolume = MakeLocalStore<number>("option-master-volume", 0.25);
export type AudioResampleModeType = 'js' | 'apu';
export const AudioResampleMode = MakeLocalStore<AudioResampleModeType>('option-audio-resample-mode', 'apu');
export const KeyBindingsStore = MakeLocalStore<KeyBindings>('option-keybindings', DEFAULT_KEYBINDINGS);
export const DefaultRenderMode = MakeLocalStore<RenderModeOverride>('option-default-render-mode', 'auto');
