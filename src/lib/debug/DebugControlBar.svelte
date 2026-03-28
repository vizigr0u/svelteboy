<script lang="ts">
    import { DebuggerAttached } from "stores/debugStores";
    import { loadedCartridge, loadedBootRom } from "stores/romStores";

    import { Emulator, Debug } from "../../emulator";
    import { EmulatorPaused } from "stores/playStores";

    let breakSkipCount: number = $state(1);
    let hasRomToDebug = $derived(
        $loadedBootRom != undefined || $loadedCartridge != undefined
    );

    async function onIgnoreBreakClick() {
        for (let i = 0; i < breakSkipCount + 1; i++) {
            await Emulator.RunUntilBreak();
        }
    }

    async function onRunPauseClick() {
        if (!$EmulatorPaused) {
            Emulator.Pause();
        } else {
            await Emulator.RunUntilBreak();
        }
    }
</script>

<div class="debug-control-buttons">
    <button
        onclick={onRunPauseClick}
        disabled={!$DebuggerAttached || !hasRomToDebug}
        >{$EmulatorPaused ? "Run Debug" : "Pause"}</button
    >
    <button
        onclick={Debug.Step}
        disabled={!$DebuggerAttached || !hasRomToDebug}>Step</button
    >
    <button
        onclick={Debug.RunFrame}
        disabled={!$DebuggerAttached || !hasRomToDebug}
    >
        Next Frame
    </button>
    <div class="next-frame-group">
        <button
            onclick={onIgnoreBreakClick}
            disabled={!$DebuggerAttached || !hasRomToDebug}
            >{`Ignore ${breakSkipCount} break`}</button
        >
        <div class="next-frame-count-buttons">
            <button onclick={() => breakSkipCount++}>+</button>
            <button
                onclick={() => breakSkipCount--}
                disabled={breakSkipCount <= 1}>-</button
            >
        </div>
    </div>
    <button onclick={Emulator.Reset} disabled={!hasRomToDebug}>Reset</button>
</div>

<style>
    .debug-control-buttons {
        display: flex;
        align-items: center;
    }

    .next-frame-group {
        display: flex;
    }

    .next-frame-count-buttons {
        display: flex;
        flex-direction: column;
    }

    .next-frame-count-buttons > button {
        font-size: 0.8em;
        height: 1.5em;
        padding: 0 0.2em;
    }
</style>
