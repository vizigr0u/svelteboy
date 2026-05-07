import { derived, type Readable } from 'svelte/store';
import { MakeIDBStore } from './idbStore';

export type ThemeVars = Record<string, string>;

export interface ConsoleVariant {
    id: string;
    label: string;
    vars: ThemeVars;
}

export type ConsoleFamilyId = 'dmg' | 'pocket' | 'color';

export interface ConsoleFamily {
    id: ConsoleFamilyId;
    label: string;
    shellName: string;
    shapeVars: ThemeVars;
    variants: ConsoleVariant[];
}

export interface ThemeSelection {
    family: ConsoleFamilyId;
    variant: string;
}

const DMG_SHAPE: ThemeVars = {
    '--shell-radius': '2% 2% 9% 2%',
    '--bezel-radius': '1% 1% 4% 1%',
    '--ab-button-shape': '50%',
    '--name-style': 'italic',
};

const POCKET_SHAPE: ThemeVars = {
    '--shell-radius': '4% 4% 6% 4%',
    '--bezel-radius': '2% 2% 2% 2%',
    '--ab-button-shape': '50%',
    '--name-style': 'italic',
};

const COLOR_SHAPE: ThemeVars = {
    '--shell-radius': '6% 6% 6% 6%',
    '--bezel-radius': '2% 2% 6% 2%',
    '--ab-button-shape': '50%',
    '--name-style': 'italic',
};

const DMG_VARIANTS: ConsoleVariant[] = [
    {
        id: 'original', label: 'Original',
        vars: {
            '--shell-bg': '#bbb',
            '--bezel-bg': '#68717a',
            '--name-color': '#12153d',
            '--button-label': '#12153d',
            '--dpad-plate-bg': '#b2b2b2',
            '--dpad-button': '#000',
            '--ss-button': '#555',
            '--ab-plate-bg': '#afafaf',
            '--ab-button': '#64213e',
        },
    },
    {
        id: 'red', label: 'Red',
        vars: {
            '--shell-bg': '#a8312e',
            '--bezel-bg': '#3a3a3a',
            '--name-color': '#f4e3c4',
            '--button-label': '#f4e3c4',
            '--dpad-plate-bg': '#7a2522',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#7a2522',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'green', label: 'Green',
        vars: {
            '--shell-bg': '#3f7a3f',
            '--bezel-bg': '#1f2f1f',
            '--name-color': '#f4e3c4',
            '--button-label': '#f4e3c4',
            '--dpad-plate-bg': '#2c5a2c',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#2c5a2c',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'blue', label: 'Blue',
        vars: {
            '--shell-bg': '#2c5fa8',
            '--bezel-bg': '#1a2a3a',
            '--name-color': '#f4e3c4',
            '--button-label': '#f4e3c4',
            '--dpad-plate-bg': '#1f4680',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#1f4680',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'yellow', label: 'Yellow',
        vars: {
            '--shell-bg': '#d6c14a',
            '--bezel-bg': '#3a3624',
            '--name-color': '#2a2410',
            '--button-label': '#2a2410',
            '--dpad-plate-bg': '#a89538',
            '--dpad-button': '#101010',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#a89538',
            '--ab-button': '#1c1c1c',
        },
    },
];

const POCKET_VARIANTS: ConsoleVariant[] = [
    {
        id: 'original', label: 'Original',
        vars: {
            '--shell-bg': '#d8d8d8',
            '--bezel-bg': '#2e2e2e',
            '--name-color': '#1a1a1a',
            '--button-label': '#1a1a1a',
            '--dpad-plate-bg': '#bcbcbc',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#3a3a3a',
            '--ab-plate-bg': '#bcbcbc',
            '--ab-button': '#3a3a3a',
        },
    },
    {
        id: 'red', label: 'Red',
        vars: {
            '--shell-bg': '#b13a3a',
            '--bezel-bg': '#2a1414',
            '--name-color': '#f4e3c4',
            '--button-label': '#f4e3c4',
            '--dpad-plate-bg': '#80262a',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#80262a',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'blue', label: 'Blue',
        vars: {
            '--shell-bg': '#3a5db1',
            '--bezel-bg': '#14202a',
            '--name-color': '#f4e3c4',
            '--button-label': '#f4e3c4',
            '--dpad-plate-bg': '#28447f',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#28447f',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'green', label: 'Green',
        vars: {
            '--shell-bg': '#3aa07a',
            '--bezel-bg': '#152a20',
            '--name-color': '#f4e3c4',
            '--button-label': '#f4e3c4',
            '--dpad-plate-bg': '#287356',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#287356',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'yellow', label: 'Yellow',
        vars: {
            '--shell-bg': '#e6d24a',
            '--bezel-bg': '#3a3624',
            '--name-color': '#2a2410',
            '--button-label': '#2a2410',
            '--dpad-plate-bg': '#b3a338',
            '--dpad-button': '#101010',
            '--ss-button': '#2a2a2a',
            '--ab-plate-bg': '#b3a338',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'black', label: 'Black',
        vars: {
            '--shell-bg': '#1c1c1c',
            '--bezel-bg': '#0a0a0a',
            '--name-color': '#cccccc',
            '--button-label': '#cccccc',
            '--dpad-plate-bg': '#101010',
            '--dpad-button': '#3a3a3a',
            '--ss-button': '#3a3a3a',
            '--ab-plate-bg': '#101010',
            '--ab-button': '#3a3a3a',
        },
    },
];

const COLOR_VARIANTS: ConsoleVariant[] = [
    {
        id: 'original', label: 'Original',
        vars: {
            '--shell-bg': '#8a4eb8',
            '--bezel-bg': '#1a1018',
            '--name-color': '#f4f0e8',
            '--button-label': '#f4f0e8',
            '--dpad-plate-bg': '#5e3380',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#3a2a48',
            '--ab-plate-bg': '#5e3380',
            '--ab-button': '#2a1a36',
        },
    },
    {
        id: 'teal', label: 'Teal',
        vars: {
            '--shell-bg': '#3aaba4',
            '--bezel-bg': '#0e1f1d',
            '--name-color': '#f4f0e8',
            '--button-label': '#f4f0e8',
            '--dpad-plate-bg': '#287a76',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#1f3a38',
            '--ab-plate-bg': '#287a76',
            '--ab-button': '#142a28',
        },
    },
    {
        id: 'berry', label: 'Berry',
        vars: {
            '--shell-bg': '#c64a8e',
            '--bezel-bg': '#221018',
            '--name-color': '#f4f0e8',
            '--button-label': '#f4f0e8',
            '--dpad-plate-bg': '#8e3464',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#3a1f30',
            '--ab-plate-bg': '#8e3464',
            '--ab-button': '#2a1424',
        },
    },
    {
        id: 'dandelion', label: 'Dandelion',
        vars: {
            '--shell-bg': '#f0d34a',
            '--bezel-bg': '#3a3624',
            '--name-color': '#2a2410',
            '--button-label': '#2a2410',
            '--dpad-plate-bg': '#bfa838',
            '--dpad-button': '#101010',
            '--ss-button': '#2a2410',
            '--ab-plate-bg': '#bfa838',
            '--ab-button': '#1c1c1c',
        },
    },
    {
        id: 'grape', label: 'Grape',
        vars: {
            '--shell-bg': '#5b3aa0',
            '--bezel-bg': '#161028',
            '--name-color': '#f4f0e8',
            '--button-label': '#f4f0e8',
            '--dpad-plate-bg': '#3f2870',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#251a40',
            '--ab-plate-bg': '#3f2870',
            '--ab-button': '#181028',
        },
    },
    {
        id: 'kiwi', label: 'Kiwi',
        vars: {
            '--shell-bg': '#7ab84a',
            '--bezel-bg': '#1a2a14',
            '--name-color': '#0e1a0a',
            '--button-label': '#0e1a0a',
            '--dpad-plate-bg': '#578a32',
            '--dpad-button': '#0e0e0e',
            '--ss-button': '#1f3a14',
            '--ab-plate-bg': '#578a32',
            '--ab-button': '#142a14',
        },
    },
];

export const FAMILIES: readonly ConsoleFamily[] = [
    { id: 'dmg',    label: 'DMG-01',           shellName: 'Svelte BOY',         shapeVars: DMG_SHAPE,    variants: DMG_VARIANTS },
    { id: 'pocket', label: 'Svelte Boy Pocket', shellName: 'Svelte BOY POCKET',  shapeVars: POCKET_SHAPE, variants: POCKET_VARIANTS },
    { id: 'color',  label: 'Svelte Boy Color',  shellName: 'Svelte BOY COLOR',   shapeVars: COLOR_SHAPE,  variants: COLOR_VARIANTS },
] as const;

const DEFAULT_THEME: ThemeSelection = { family: 'dmg', variant: 'original' };

function migrate(stored: ThemeSelection): ThemeSelection {
    const family = FAMILIES.find(f => f.id === stored?.family);
    if (!family) return DEFAULT_THEME;
    const variant = family.variants.find(v => v.id === stored.variant);
    if (!variant) return { family: family.id, variant: family.variants[0].id };
    return stored;
}

export const SelectedConsoleTheme = MakeIDBStore<ThemeSelection>(
    'option-console-theme',
    DEFAULT_THEME,
    migrate,
);

export function findFamily(id: ConsoleFamilyId): ConsoleFamily {
    return FAMILIES.find(f => f.id === id) ?? FAMILIES[0];
}

export function findVariant(family: ConsoleFamily, variantId: string): ConsoleVariant {
    return family.variants.find(v => v.id === variantId) ?? family.variants[0];
}

export function resolveStyle(sel: ThemeSelection): string {
    const family = findFamily(sel.family);
    const variant = findVariant(family, sel.variant);
    const merged = { ...family.shapeVars, ...variant.vars };
    return Object.entries(merged).map(([k, v]) => `${k}: ${v};`).join(' ');
}

export const ResolvedTheme: Readable<{ family: ConsoleFamily; variant: ConsoleVariant; style: string }> =
    derived(SelectedConsoleTheme, ($s) => {
        const family = findFamily($s.family);
        const variant = findVariant(family, $s.variant);
        return { family, variant, style: resolveStyle($s) };
    });
