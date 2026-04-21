<script lang="ts">
    import { KeyBindingsStore } from "stores/optionsStore";
    import {
        AB_PRESETS, SELECT_PRESETS, DPAD_PRESETS,
        matchesAbPreset, matchesDpadPreset,
        abConflictReason, selectConflictReason, dpadConflictReason,
        displayKey,
    } from "../keybindPresets";
</script>

<div class="controls-view debug-tool-container">
    <h3>Controls</h3>
    <div class="controls-section">
        <div class="control-row">
            <span class="control-label">D-Pad</span>
            <div class="preset-group">
                {#each DPAD_PRESETS as preset}
                    {@const conflict = dpadConflictReason(preset, $KeyBindingsStore)}
                    <button
                        class="preset-btn"
                        class:active={matchesDpadPreset($KeyBindingsStore, preset)}
                        class:conflicted={!!conflict}
                        title={conflict ?? ''}
                        onclick={() => { if (!conflict) KeyBindingsStore.update(b => ({ ...b, up: preset.up, down: preset.down, left: preset.left, right: preset.right })); }}
                    >{preset.label}</button>
                {/each}
            </div>
        </div>
        <div class="control-row">
            <span class="control-label">A / B</span>
            <div class="preset-group">
                {#each AB_PRESETS as preset}
                    {@const conflict = abConflictReason(preset, $KeyBindingsStore)}
                    <button
                        class="preset-btn"
                        class:active={matchesAbPreset($KeyBindingsStore, preset)}
                        class:conflicted={!!conflict}
                        title={conflict ?? ''}
                        onclick={() => { if (!conflict) KeyBindingsStore.update(b => ({ ...b, a: preset.a, b: preset.b })); }}
                    >{preset.label}</button>
                {/each}
            </div>
        </div>
        <div class="control-row">
            <span class="control-label">Select</span>
            <div class="preset-group">
                {#each SELECT_PRESETS as key}
                    {@const conflict = selectConflictReason(key, $KeyBindingsStore)}
                    <button
                        class="preset-btn"
                        class:active={$KeyBindingsStore.select === key}
                        class:conflicted={!!conflict}
                        title={conflict ?? ''}
                        onclick={() => { if (!conflict) KeyBindingsStore.update(b => ({ ...b, select: key })); }}
                    >{key}</button>
                {/each}
            </div>
        </div>
        <div class="mapping-legend">
            <span>{displayKey($KeyBindingsStore.up)}{displayKey($KeyBindingsStore.down)}{displayKey($KeyBindingsStore.left)}{displayKey($KeyBindingsStore.right)}</span>
            <span>A={displayKey($KeyBindingsStore.a)}</span>
            <span>B={displayKey($KeyBindingsStore.b)}</span>
            <span>Start=Enter</span>
            <span>Select={displayKey($KeyBindingsStore.select)}</span>
        </div>
    </div>
</div>

<style>
    .controls-section {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
    }

    .control-row {
        display: flex;
        align-items: center;
        gap: 0.75em;
    }

    .control-label {
        width: 4em;
        font-weight: bold;
    }

    .preset-group {
        display: flex;
        gap: 0.3em;
        flex-wrap: wrap;
    }

    .preset-btn {
        padding: 0.2em 0.6em;
        border: 1px solid #555;
        background: transparent;
        color: inherit;
        cursor: pointer;
        border-radius: 4px;
        font-size: 0.85em;
    }

    .preset-btn.active {
        background: #555;
        border-color: #aaa;
    }

    .preset-btn:hover:not(.active):not(.conflicted) {
        background: #333;
    }

    .preset-btn.conflicted {
        opacity: 0.35;
        cursor: not-allowed;
        border-style: dashed;
    }

    .mapping-legend {
        display: flex;
        gap: 1em;
        font-size: 0.8em;
        opacity: 0.7;
        margin-top: 0.25em;
    }
</style>
