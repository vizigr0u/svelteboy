<script lang="ts">
    import { get } from "svelte/store";
    import type { LibraryRom } from "../../types";
    import { setRenderModeForRom } from "stores/libraryStore";
    import { prefsForRom, setPrefsFor, loadedCartridge } from "stores/romStores";
    import { EmulatorPaused, PlayStartTime } from "stores/playStores";
    import { showToast } from "stores/toastStore";
    import { requestConfirm } from "stores/confirmStore";
    import { playRom } from "../../emulator/rom";
    import { Debug } from "../../emulator";
    import type { RenderModeOverride } from "../../cartType";

    // Prompt if the user has been playing for a while, to avoid accidental loss of progress.
    const RESTART_PROMPT_THRESHOLD_MS = 20_000;

    let { rom } = $props<{ rom: LibraryRom }>();
    let prefs = $derived(prefsForRom(rom.sha1));
    let currentMode = $derived<RenderModeOverride>(rom.renderMode ?? 'auto');
    let mutedChannels = $derived($prefs.mutedChannels ?? []);
    let skipBootRom = $derived($prefs.skipBootRom ?? false);
    let slotCount = $derived($prefs.quickSaveSlotCount ?? 9);
    let rtcOffsetSec = $derived($prefs.rtcOffsetSec ?? 0);
    let rtcDays = $derived(Math.floor(rtcOffsetSec / 86400));
    let rtcHours = $derived(Math.floor((rtcOffsetSec % 86400) / 3600));
    let rtcMins = $derived(Math.floor((rtcOffsetSec % 3600) / 60));
    let rtcPreviewRelative = $derived(formatRelative(rtcOffsetSec));
    let rtcPreviewAbsolute = $derived(formatAbsolute(rtcOffsetSec));

    function formatRelative(sec: number): string {
        if (sec <= 0) return 'no offset';
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const parts: string[] = [];
        if (d) parts.push(`${d}d`);
        if (h) parts.push(`${h}h`);
        if (m) parts.push(`${m}m`);
        return '+' + (parts.join(' ') || '0m');
    }

    function formatAbsolute(sec: number): string {
        const d = new Date(Date.now() + sec * 1000);
        return d.toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    function setRtcOffset(days: number, hours: number, mins: number) {
        const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.floor(v || 0)));
        const total = clamp(days, 9999) * 86400 + clamp(hours, 23) * 3600 + clamp(mins, 59) * 60;
        setPrefsFor(rom.sha1, { rtcOffsetSec: total });
        showToast('Saved RTC offset.', 'info');
    }

    function changeRtcDays(e: Event) {
        setRtcOffset(Number((e.target as HTMLInputElement).value), rtcHours, rtcMins);
    }
    function changeRtcHours(e: Event) {
        setRtcOffset(rtcDays, Number((e.target as HTMLInputElement).value), rtcMins);
    }
    function changeRtcMins(e: Event) {
        setRtcOffset(rtcDays, rtcHours, Number((e.target as HTMLInputElement).value));
    }
    function resetRtc() {
        setPrefsFor(rom.sha1, { rtcOffsetSec: 0 });
        showToast('Reset RTC offset.', 'info');
    }

    async function changeRenderMode(mode: RenderModeOverride) {
        if (mode === currentMode) return;
        await setRenderModeForRom(rom.sha1, mode);
        showToast('Saved render mode.', 'info');

        const cart = get(loadedCartridge);
        const running = !!cart && cart.sha1 === rom.sha1 && !get(EmulatorPaused);
        if (!running) return;

        const playedMs = Date.now() - get(PlayStartTime);
        if (playedMs >= RESTART_PROMPT_THRESHOLD_MS) {
            const ok = await requestConfirm({
                title: 'Apply render mode now?',
                message: 'Changing render mode requires resetting the running game. Unsaved progress since the last autosave may be lost. Reset now?',
                confirmLabel: 'Reset',
                cancelLabel: 'Later',
            });
            if (!ok) return;
        }
        await playRom({ ...cart, renderMode: mode });
    }

    function toggleMute(ch: number) {
        const next = mutedChannels.includes(ch)
            ? mutedChannels.filter((c: number) => c !== ch)
            : [...mutedChannels, ch];
        setPrefsFor(rom.sha1, { mutedChannels: next });
        showToast(`Saved CH${ch} mute.`, 'info');

        const cart = get(loadedCartridge);
        if (cart && cart.sha1 === rom.sha1) Debug.SetMuteChannel(ch, next.includes(ch));
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
    {#if rom.hasRtc}
        <section>
            <h3>RTC offset</h3>
            <div class="rtc-row">
                <label>
                    <input type="number" min="0" value={rtcDays} onchange={changeRtcDays} />
                    d
                </label>
                <label>
                    <input type="number" min="0" max="23" value={rtcHours} onchange={changeRtcHours} />
                    h
                </label>
                <label>
                    <input type="number" min="0" max="59" value={rtcMins} onchange={changeRtcMins} />
                    m
                </label>
                <button type="button" class="reset-btn" onclick={resetRtc}>Reset</button>
            </div>
            <p class="rtc-preview">
                {rtcPreviewRelative}
                <span class="rtc-preview-abs">({rtcPreviewAbsolute})</span>
            </p>
            <p class="hint">Forward-only. Reducing freezes RTC until real time catches up.</p>
        </section>
    {/if}
</div>

<style>
    .settings-tab {
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    section { display: flex; flex-direction: column; gap: 0.4em; }
    h3 { margin: 0; font-size: 0.9em; color: var(--text-color); }
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
        background: var(--tint-1);
    }
    .render-mode-radio.active, .mute-chip.active {
        background: var(--highlight-color);
        color: var(--background-color);
    }
    .render-mode-radio input, .mute-chip input {
        margin: 0;
        accent-color: var(--highlight-color);
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
    .hint { font-size: 0.8em; color: var(--muted-color); margin: 0; }
    .rtc-row {
        display: flex;
        align-items: center;
        gap: 0.4em;
        flex-wrap: wrap;
    }
    .rtc-row label {
        display: inline-flex;
        align-items: center;
        gap: 0.2em;
        font-size: 0.85em;
    }
    .rtc-row input[type="number"] {
        width: 4em;
    }
    .reset-btn {
        font-size: 0.8em;
        padding: 0.2em 0.6em;
        border-radius: 0.2em;
        background: var(--tint-1);
        color: inherit;
        border: 1px solid rgba(255, 255, 255, 0.1);
        cursor: pointer;
    }
    .reset-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    .rtc-preview {
        font-size: 0.85em;
        margin: 0;
        color: var(--text-color);
    }
    .rtc-preview-abs {
        font-size: 0.75em;
        color: var(--muted-color);
        margin-left: 0.4em;
    }
</style>
