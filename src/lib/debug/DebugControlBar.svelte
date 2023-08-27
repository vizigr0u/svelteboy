<script lang="ts">
    import {
        GbDebugInfoStore,
        ProgramRunning,
        DebugSessionStarted,
        LastStopReason,
    } from "../../stores/debugStores";
    import { loadedCartridge, loadedBootRom } from "../../stores/romStores";

    import {
        debugStep,
        debugPause,
        init,
        debugGetStatus,
        setVerbose,
        debugRunFrame,
    } from "../../../build/release";
    import { DebugStopReason, type GbDebugInfo } from "../../types";
    import { fetchLogs } from "../../debug";
    import { GameFrames } from "../../stores/playStores";
    import { frameDelay, useBoot } from "../../stores/optionsStore";

    let verbose: number = 1;

    function debuggerStep(): Promise<void> {
        return new Promise<void>((resolve) => {
            $ProgramRunning = true;
            debugStep();
            fetchLogs();
            $ProgramRunning = false;
            resolve();
        });
    }

    function initDebug() {
        init($useBoot);
        $DebugSessionStarted = true;
    }

    async function onStepClick() {
        setVerbose(verbose);
        if (!$DebugSessionStarted) {
            initDebug();
        }
        await debuggerStep();
        $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
        $GameFrames = $GbDebugInfoStore.currentFrame;
    }

    async function onStopClick() {
        $DebugSessionStarted = false;
        $ProgramRunning = false;
        init($useBoot);
    }

    async function onResetClick() {
        $ProgramRunning = false;
        initDebug();
        $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
        $GameFrames = $GbDebugInfoStore.currentFrame;
    }

    async function onRunPauseClick() {
        setVerbose(verbose);
        if ($ProgramRunning) {
            debugPause();
            fetchLogs();
            $ProgramRunning = false;

            $GameFrames = $GbDebugInfoStore.currentFrame;
        } else {
            if (!$DebugSessionStarted) {
                initDebug();
            }
            $GameFrames = 0;
            $ProgramRunning = true;
            let lastStopReason = DebugStopReason.None;
            do {
                lastStopReason = await new Promise<DebugStopReason>((r) => {
                    r(debugRunFrame());
                });
                await fetchLogs();
                $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
                $GameFrames = $GbDebugInfoStore.currentFrame;
                if (lastStopReason == DebugStopReason.EndOfFrame)
                    await new Promise((r) => setTimeout(r, $frameDelay));
            } while (
                $ProgramRunning &&
                lastStopReason == DebugStopReason.EndOfFrame
            );
            $LastStopReason = lastStopReason;
            $ProgramRunning = false;
        }
    }

    function onVerboseChange() {
        setVerbose(verbose);
    }
</script>

<div class="debug-control-buttons">
    <button
        on:click={onRunPauseClick}
        disabled={$loadedBootRom == undefined && $loadedCartridge == undefined}
        >{$ProgramRunning ? "Pause" : "Run"}</button
    >
    <button
        on:click={onStepClick}
        disabled={$loadedBootRom == undefined && $loadedCartridge == undefined}
        >Step</button
    >
    <button on:click={onResetClick} disabled={$DebugSessionStarted}
        >{$DebugSessionStarted ? "Reset" : "Init"}</button
    >
    <button on:click={onStopClick} disabled={!$DebugSessionStarted}>Stop</button
    >
    <label
        >Verbose
        <input
            type="number"
            class="verbose-input"
            bind:value={verbose}
            on:change={onVerboseChange}
            min="0"
            max="10"
        />
    </label>
</div>

<style>
    .debug-control-buttons {
        display: flex;
        align-items: center;
    }

    .verbose-input {
        max-width: 3em;
    }
</style>
