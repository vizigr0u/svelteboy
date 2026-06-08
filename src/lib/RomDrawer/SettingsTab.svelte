<script lang="ts">
    import type { LibraryRom } from "../../types";
    import { setRenderModeForRom } from "stores/libraryStore";
    import { prefsForRom, setPrefsFor } from "stores/romStores";
    import { showToast } from "stores/toastStore";
    import type { RenderModeOverride } from "../../cartType";

    let { rom } = $props<{ rom: LibraryRom }>();
    let prefs = $derived(prefsForRom(rom.sha1));
    let currentMode = $derived<RenderModeOverride>(rom.renderMode ?? 'auto');
    let mutedChannels = $derived($prefs.mutedChannels ?? []);
    let skipBootRom = $derived($prefs.skipBootRom ?? false);
    let slotCount = $derived($prefs.quickSaveSlotCount ?? 4);

    async function changeRenderMode(mode: RenderModeOverride) {
        if (mode === currentMode) return;
        await setRenderModeForRom(rom.sha1, mode);
        showToast('Saved render mode.', 'info');
    }

    function toggleMute(ch: number) {
        const next = mutedChannels.includes(ch)
            ? mutedChannels.filter((c: number) => c !== ch)
            : [...mutedChannels, ch];
        setPrefsFor(rom.sha1, { mutedChannels: next });
        showToast(`Saved CH${ch} mute.`, 'info');
    }

    function toggleSkipBoot(e: Event) {
        const v = (e.target as HTMLInputElement).checked;
        setPrefsFor(rom.sha1, { skipBootRom: v });
        showToast('Saved skip-boot preference.', 'info');
    }

    function changeSlotCount(e: Event) {
        const v = Number((e.target as HTMLInputElement).value);
        if (!Number.isFinite(v) || v < 1 || v > 20) return;
        setPrefsFor(rom.sha1, { quickSaveSlotCount: v });
        showToast(`Saved slot count (${v}).`, 'info');
    }
</script>

<div class="settings-tab">
    <section>
        <h3>Render mode</h3>
        <div class="render-mode-row" role="radiogroup" aria-label="Render mode">
            {#each [['auto', 'Auto'], ['force-gb', 'GB'], ['force-cgb', 'CGB']] as [value, label]}
                <label class="render-mode-radio" class:active={currentMode === value}>
                    <input
                        type="radio"
                        name="drawer-render-mode-{rom.sha1}"
                        value={value}
                        checked={currentMode === value}
                        onchange={() => changeRenderMode(value as RenderModeOverride)}
                    />
                    {label}
                </label>
            {/each}
        </div>
    </section>
    <section>
        <h3>Audio channels</h3>
        <div class="mute-row">
            {#each [1, 2, 3, 4] as ch}
                <label class="mute-chip" class:active={mutedChannels.includes(ch)}>
                    <input
                        type="checkbox"
                        checked={mutedChannels.includes(ch)}
                        onchange={() => toggleMute(ch)}
                    />
                    CH{ch}
                </label>
            {/each}
        </div>
        <p class="hint">Per-ROM mute preferences (applied at play time).</p>
    </section>
    <section>
        <h3>Boot ROM</h3>
        <label class="switch-row">
            <input type="checkbox" checked={skipBootRom} onchange={toggleSkipBoot} />
            Skip boot ROM for this game
        </label>
    </section>
    <section>
        <h3>Quick saves</h3>
        <label class="switch-row">
            Slots:
            <input type="number" min="1" max="20" value={slotCount} onchange={changeSlotCount} />
        </label>
    </section>
</div>

<style>
    .settings-tab {
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    section { display: flex; flex-direction: column; gap: 0.4em; }
    h3 { margin: 0; font-size: 0.9em; color: #cdd6f4; }
    .render-mode-row, .mute-row {
        display: flex;
        gap: 0.3em;
        flex-wrap: wrap;
    }
    .render-mode-radio, .mute-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25em;
        font-size: 0.85em;
        padding: 0.2em 0.6em;
        border-radius: 0.2em;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.05);
    }
    .render-mode-radio.active, .mute-chip.active {
        background: var(--highlight-color, #89b4fa);
        color: #1e1e2e;
    }
    .render-mode-radio input, .mute-chip input {
        margin: 0;
        accent-color: var(--highlight-color, #89b4fa);
    }
    .switch-row {
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-size: 0.9em;
    }
    .switch-row input[type="number"] {
        width: 4em;
    }
    .hint { font-size: 0.8em; color: #888; margin: 0; }
</style>
