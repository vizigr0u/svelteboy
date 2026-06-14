<script lang="ts">
    import {
        showFrametimeHistogram,
        AutoSaveUriRoms,
        RegularSpeed,
        BurstSpeed,
        MuteOnFastForward,
        PauseOnVisibilityLost,
        AutoSnapEnabled,
        AudioMasterVolume,
        AudioResampleMode,
        DefaultRenderMode,
        CgbColor,
        GhostingStrength,
        ScreenshotSize,
        PixelPerfect,
        HapticsEnabled,
        WakeLockEnabled,
        OrientationLockEnabled,
    } from "stores/optionsStore";
    import {
        HudStore,
        HUD_CHIP_LABELS,
        HUD_POSITION_LABELS,
        setHudChip,
        setHudPosition,
        type HudChipId,
        type HudPosition,
    } from "stores/hudStore";
    import { clearAllStorage } from "../../stores/idbStore";
    import { isCgbMode } from "../../emulator/wasmBridge";
    import { EmulatorInitialized, GameFrames } from "stores/playStores";
    import { debugUnlocked } from "stores/paletteStore";
    import PalettePicker from "../PalettePicker.svelte";
    import DisabledTooltip from "../DisabledTooltip.svelte";
    import ControlsView from "../ControlsView.svelte";
    import BindingsView from "../BindingsView.svelte";
    import AboutView from "../AboutView.svelte";

    type Section = "display" | "audio" | "controls" | "hud" | "system" | "advanced" | "about";
    let section: Section | null = $state(null);

    let cgbActive = $derived.by(() => { $EmulatorInitialized; $GameFrames; return isCgbMode(); });
    let romLoaded = $derived($EmulatorInitialized);
    let isCoarse = $state(false);
    $effect(() => {
        const mql = window.matchMedia("(pointer: coarse)");
        const upd = () => (isCoarse = mql.matches);
        upd();
        mql.addEventListener("change", upd);
        return () => mql.removeEventListener("change", upd);
    });

    let DebugSection: any = $state(null);
    $effect(() => {
        if (section === "advanced" && $debugUnlocked && !DebugSection) {
            import("../debug/DebugSection.svelte").then(m => (DebugSection = m.default));
        }
    });

    const ROWS: { key: Section; label: string; gated?: boolean }[] = [
        { key: "display", label: "Display" },
        { key: "audio", label: "Audio" },
        { key: "controls", label: "Controls" },
        { key: "hud", label: "HUD" },
        { key: "system", label: "System" },
        { key: "advanced", label: "Advanced", gated: true },
        { key: "about", label: "About" },
    ];
    let rows = $derived(ROWS.filter(r => !r.gated || $debugUnlocked));

    async function clearAll() {
        if (!confirm("This will permanently delete ALL stored ROMs, save games, and preferences. Continue?")) return;
        await clearAllStorage();
        location.reload();
    }
</script>

{#if section === null}
    <ul class="section-list">
        {#each rows as r}
            <li>
                <button onclick={() => (section = r.key)}>
                    <span class="lbl">{r.label}</span>
                    <span class="chev">›</span>
                </button>
            </li>
        {/each}
    </ul>
{:else}
    <div class="subpage">
        <button class="back" onclick={() => (section = null)}>‹ Options</button>

        {#if section === "display"}
            <h4>Display</h4>
            <div class="grid">
                <span class="lab">Palette (GB):</span>
                <DisabledTooltip disabled={romLoaded && cgbActive} message="GB palette is unused in CGB mode.">
                    <PalettePicker />
                </DisabledTooltip>

                <label for="cgbColor">CGB color treatment:</label>
                <DisabledTooltip disabled={romLoaded && !cgbActive} message="CGB color treatment is unused in GB mode.">
                    <select id="cgbColor" bind:value={$CgbColor}>
                        <option value="none">None</option>
                        <option value="lut">Original colors (Gambatte LUT)</option>
                        <option value="subpixel">Original subpixels (LCD effect)</option>
                    </select>
                </DisabledTooltip>

                <label for="pixelPerfect">Pixel-perfect scale:</label>
                <input id="pixelPerfect" type="checkbox" bind:checked={$PixelPerfect} />

                <label for="ghosting">Ghosting / motion blur:</label>
                <input id="ghosting" type="range" min="0" max="0.9" step="0.05" bind:value={$GhostingStrength} />

                <label for="screenshotSize">Screenshot size:</label>
                <select id="screenshotSize" bind:value={$ScreenshotSize}>
                    <option value="gb">GB native (160×144, raw)</option>
                    <option value="canvas">Canvas size (with shaders)</option>
                </select>
            </div>
        {:else if section === "audio"}
            <h4>Audio</h4>
            <div class="grid">
                <label for="mastervolume">Master volume:</label>
                <input id="mastervolume" type="range" min="0" max="1" step="0.01" bind:value={$AudioMasterVolume} />

                <label for="resamplemode">Resample mode:</label>
                <select id="resamplemode" bind:value={$AudioResampleMode}>
                    <option value="apu">APU-side (clean anti-alias)</option>
                    <option value="js">JS-side (linear interp)</option>
                </select>

                <label for="muteff">Mute while burst active:</label>
                <input id="muteff" type="checkbox" bind:checked={$MuteOnFastForward} />
            </div>
        {:else if section === "controls"}
            <h4>Controls</h4>
            <ControlsView />
            {#if !isCoarse}
                <h4>Keyboard bindings</h4>
                <BindingsView />
            {/if}
        {:else if section === "hud"}
            <h4>HUD</h4>
            <div class="grid">
                <label for="hudPosition">Chip position:</label>
                <select id="hudPosition" value={$HudStore.position} onchange={(e) => setHudPosition((e.currentTarget as HTMLSelectElement).value as HudPosition)}>
                    {#each Object.entries(HUD_POSITION_LABELS) as [val, label]}
                        <option value={val}>{label}</option>
                    {/each}
                </select>

                <label for="showframetime">Frametime histogram:</label>
                <input id="showframetime" type="checkbox" bind:checked={$showFrametimeHistogram} />
            </div>
            <span class="lab">Chips:</span>
            <div class="chip-row">
                {#each Object.entries(HUD_CHIP_LABELS) as [id, label]}
                    {#if id !== 'rewind'}
                        <label class="toggle">
                            <input type="checkbox" checked={$HudStore.enabled[id as HudChipId]}
                                onchange={(e) => setHudChip(id as HudChipId, (e.currentTarget as HTMLInputElement).checked)} />
                            {label}
                        </label>
                    {/if}
                {/each}
            </div>
        {:else if section === "system"}
            <h4>Emulation</h4>
            <div class="grid">
                <label for="defaultRenderMode">Default mode:</label>
                <select id="defaultRenderMode" bind:value={$DefaultRenderMode}>
                    <option value="auto">Auto (per cart)</option>
                    <option value="force-gb">Force GB</option>
                    <option value="force-cgb">Force CGB</option>
                </select>

                <label for="regularspeed">Regular speed:</label>
                <input id="regularspeed" type="number" min="0.01" max="100" step="0.1" bind:value={$RegularSpeed} />

                <label for="burstspeed">Burst speed (hold Space):</label>
                <input id="burstspeed" type="number" min="0.01" max="100" step="0.1" bind:value={$BurstSpeed} />

                <label for="pauseOnVisibilityLost">Pause when tab hidden:</label>
                <input id="pauseOnVisibilityLost" type="checkbox" bind:checked={$PauseOnVisibilityLost} />

                <label for="autoSnapEnabled">Auto-save session (30s + exit):</label>
                <input id="autoSnapEnabled" type="checkbox" bind:checked={$AutoSnapEnabled} />

                <label for="autoSaveUri">Auto-save URI ROMs after first play:</label>
                <input id="autoSaveUri" type="checkbox" bind:checked={$AutoSaveUriRoms} />
            </div>

            <h4>Device</h4>
            <div class="grid">
                <label for="haptics">Haptic feedback on tap:</label>
                <input id="haptics" type="checkbox" bind:checked={$HapticsEnabled} />

                <label for="wakelock">Keep screen awake while playing:</label>
                <input id="wakelock" type="checkbox" bind:checked={$WakeLockEnabled} />

                <label for="orientlock">Lock orientation in fullscreen:</label>
                <input id="orientlock" type="checkbox" bind:checked={$OrientationLockEnabled} />
            </div>

            <h4>Danger zone</h4>
            <button class="danger" onclick={clearAll}>Wipe all ROMs &amp; preferences</button>
        {:else if section === "advanced"}
            <h4>Advanced</h4>
            {#if DebugSection}
                <DebugSection />
            {:else}
                <p class="loading">Loading debug tools…</p>
            {/if}
        {:else if section === "about"}
            <h4>About SvelteBoy</h4>
            <AboutView />
        {/if}
    </div>
{/if}

<style>
    .section-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25em; }
    .section-list button {
        display: flex; align-items: center; gap: 0.7em; width: 100%;
        background: rgba(255,255,255,0.04); border: 1px solid #313244;
        color: inherit; padding: 0.85em 0.9em; border-radius: 0.5em;
        cursor: pointer; font-size: 1em; text-align: left;
    }
    .section-list button:hover { background: rgba(255,255,255,0.08); }
    .lbl { flex: 1; }
    .chev { opacity: 0.5; font-size: 1.2em; }

    .subpage { display: flex; flex-direction: column; gap: 0.5em; }
    .back {
        align-self: flex-start;
        background: none; border: none; color: var(--highlight-color, #89b4fa);
        cursor: pointer; font-size: 0.95em; padding: 0.2em 0;
    }
    h4 { margin: 0.6em 0 0.2em; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
    .grid { display: grid; grid-template-columns: 13em minmax(0, 1fr); align-items: center; gap: 0.3em 0.5em; }
    .grid input[type="checkbox"] { margin-right: auto; }
    .lab { display: flex; align-items: center; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 0.4em 0.8em; }
    .toggle { display: inline-flex; align-items: center; gap: 0.3em; font-size: 0.9em; }
    .danger { color: #f38ba8; align-self: flex-start; background: none; border: 1px solid #45475a; padding: 0.4em 0.8em; border-radius: 0.3em; cursor: pointer; }
    .danger:hover { background: rgba(243,139,168,0.12); }
    .loading { color: #888; font-style: italic; }
</style>
