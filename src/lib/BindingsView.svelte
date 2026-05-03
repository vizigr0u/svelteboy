<script lang="ts">
    import { KeyBindingsStore, HideKeyboardWarning } from "stores/optionsStore";
    import { displayKey } from "../keybindPresets";
    import ControlsView from "./ControlsView.svelte";

    function resetKeybindingDisclaimer() {
        HideKeyboardWarning.set(false);
    }

    const gameInputs = $derived([
        { label: 'D-Pad ↑',   keys: [displayKey($KeyBindingsStore.up)] },
        { label: 'D-Pad ↓',   keys: [displayKey($KeyBindingsStore.down)] },
        { label: 'D-Pad ←',   keys: [displayKey($KeyBindingsStore.left)] },
        { label: 'D-Pad →',   keys: [displayKey($KeyBindingsStore.right)] },
        { label: 'A',         keys: [displayKey($KeyBindingsStore.a)] },
        { label: 'B',         keys: [displayKey($KeyBindingsStore.b)] },
        { label: 'Start',     keys: ['Enter'] },
        { label: 'Select',    keys: [displayKey($KeyBindingsStore.select)] },
    ]);

    const systemShortcuts = [
        { label: 'Pause / Resume',     keys: ['P'] },
        { label: 'Reset',              keys: ['R'] },
        { label: 'Burst speed (hold)', keys: ['Space'] },
        { label: 'Quick Save slot 1-4', keys: ['Shift', '+', '1'], note: '…4' },
        { label: 'Quick Load slot 1-4', keys: ['1'], note: '…4' },
        { label: 'Toggle fullscreen',  keys: ['Double-click screen'] },
    ];
</script>

<div class="bindings-view debug-tool-container">
    <h3>Bindings</h3>

    <ControlsView />

    <h4>Game Inputs</h4>
    <table class="shortcuts">
        <tbody>
            {#each gameInputs as row}
                <tr>
                    <td class="action">{row.label}</td>
                    <td class="keys">
                        {#each row.keys as k}<kbd>{k}</kbd>{/each}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>

    <h4>System Shortcuts</h4>
    <table class="shortcuts">
        <tbody>
            {#each systemShortcuts as row}
                <tr>
                    <td class="action">{row.label}</td>
                    <td class="keys">
                        {#each row.keys as k, i}
                            {#if k === '+'}<span class="plus">+</span>{:else}<kbd>{k}</kbd>{/if}
                        {/each}
                        {#if row.note}<span class="note">{row.note}</span>{/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>

    <div class="actions">
        <button onclick={resetKeybindingDisclaimer}>Reset keybinding disclaimer</button>
    </div>
</div>

<style>
    h4 {
        margin: 0.8em 0 0.3em;
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #888;
    }

    .shortcuts {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9em;
    }

    .shortcuts td {
        padding: 0.25em 0.4em;
        border-bottom: 1px solid #2a2a3a;
    }

    .shortcuts tr:last-child td {
        border-bottom: none;
    }

    .action {
        opacity: 0.85;
    }

    .keys {
        text-align: right;
        white-space: nowrap;
    }

    kbd {
        display: inline-block;
        padding: 0.1em 0.4em;
        margin: 0 0.15em;
        background: #313244;
        border: 1px solid #45475a;
        border-radius: 0.25em;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.85em;
        color: #cdd6f4;
    }

    .plus {
        opacity: 0.6;
    }

    .note {
        margin-left: 0.4em;
        opacity: 0.6;
        font-size: 0.85em;
    }

    .actions {
        display: flex;
        gap: 0.5em;
        margin-top: 1em;
    }

    .actions button {
        width: fit-content;
    }
</style>
