<script lang="ts">
    import { FAMILIES, SelectedConsoleTheme, findFamily, type ConsoleFamilyId } from "../stores/consoleThemeStore";

    function pickFamily(id: ConsoleFamilyId) {
        const fam = findFamily(id);
        const cur = $SelectedConsoleTheme;
        const sameVariant = fam.variants.find(v => v.id === cur.variant);
        SelectedConsoleTheme.set({
            family: id,
            variant: sameVariant ? sameVariant.id : fam.variants[0].id,
        });
    }

    function pickVariant(variantId: string) {
        SelectedConsoleTheme.update(s => ({ ...s, variant: variantId }));
    }

    let currentFamily = $derived(findFamily($SelectedConsoleTheme.family));
</script>

<div class="theme-picker">
    <div class="family-row" role="radiogroup" aria-label="Console family">
        {#each FAMILIES as fam}
            <button
                type="button"
                role="radio"
                aria-checked={$SelectedConsoleTheme.family === fam.id}
                class:active={$SelectedConsoleTheme.family === fam.id}
                onclick={() => pickFamily(fam.id)}
            >
                {fam.label}
            </button>
        {/each}
    </div>
    <div class="variant-row">
        {#each currentFamily.variants as v}
            <button
                type="button"
                class:active={$SelectedConsoleTheme.variant === v.id}
                style="--swatch: {v.vars['--shell-bg']};"
                onclick={() => pickVariant(v.id)}
                aria-label={v.label}
                title={v.label}
            >
                <span class="swatch"></span>
                <span class="label">{v.label}</span>
            </button>
        {/each}
    </div>
</div>

<style>
    .theme-picker {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        min-width: 0;
    }
    .family-row {
        display: flex;
        gap: 0.3em;
        flex-wrap: wrap;
    }
    .family-row button {
        padding: 0.3em 0.7em;
        border-radius: 0.3em;
        background: var(--button-background-color);
        border: 1px solid transparent;
        color: var(--text-color);
        cursor: pointer;
    }
    .family-row button.active {
        border-color: var(--highlight-color);
    }
    .variant-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3em;
    }
    .variant-row button {
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
        padding: 0.25em 0.55em 0.25em 0.35em;
        border-radius: 0.3em;
        background: var(--subsection-bg-color);
        border: 1px solid transparent;
        color: var(--text-color);
        cursor: pointer;
        font-size: 0.85em;
    }
    .variant-row button.active {
        border-color: var(--highlight-color);
    }
    .swatch {
        width: 0.9em;
        height: 0.9em;
        border-radius: 50%;
        background: var(--swatch);
        border: 1px solid rgba(0,0,0,0.4);
        flex: none;
    }
    .label {
        white-space: nowrap;
    }
</style>
