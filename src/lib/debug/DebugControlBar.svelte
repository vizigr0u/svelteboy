<script lang="ts">
    import {
        GbDebugInfoStore,
        ProgramRunning,
        DebugSessionStarted,
    } from "../../stores/debugStores";
    import { loadedRomsStore } from "../../stores/romStores";

    import {
        debugStep,
        debugPause,
        init,
        debugGetStatus,
        setVerbose,
        debugRunFrame,
    } from "../../../build/release";
    import type { GbDebugInfo } from "../../types";
    import { fetchLogs } from "../../debug";

    let verbose: number = 2;
    let useBoot: boolean = false;

    function runDebugger(maxCycles: number): Promise<GbDebugInfo> {
        return new Promise<GbDebugInfo>((resolve) => {
            debugRunFrame(maxCycles);
            resolve(debugGetStatus() as GbDebugInfo);
        });
    }

    function debuggerStep(): Promise<GbDebugInfo> {
        return new Promise<GbDebugInfo>((resolve) => {
            debugStep();
            fetchLogs();
            resolve(debugGetStatus() as GbDebugInfo);
        });
    }

    function initDebug() {
        init(useBoot);
        $DebugSessionStarted = true;
    }

    async function onStepClick() {
        setVerbose(verbose);
        if (!$DebugSessionStarted) {
            initDebug();
        }
        $ProgramRunning = true;
        $GbDebugInfoStore = await debuggerStep();
        $ProgramRunning = false;
    }

    async function onStopClick() {
        $DebugSessionStarted = false;
        $ProgramRunning = false;
        init(useBoot);
    }

    async function onResetClick() {
        $ProgramRunning = false;
        initDebug();
        $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
    }

    async function onRunPauseClick() {
        setVerbose(verbose);
        if ($ProgramRunning) {
            debugPause();
            $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
            fetchLogs();
            $ProgramRunning = false;
        } else {
            if (!$DebugSessionStarted) {
                initDebug();
            }
            $ProgramRunning = true;
            do {
                $GbDebugInfoStore = await runDebugger(50000);
                await fetchLogs();
                await new Promise((resolve) => setTimeout(resolve, 20));
            } while (
                $ProgramRunning &&
                ($GbDebugInfoStore == undefined ||
                    !$GbDebugInfoStore.stoppedByBreakpoint)
            );
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
        disabled={$loadedRomsStore.every((s) => s == undefined)}
        >{$ProgramRunning ? "Pause" : "Run"}</button
    >
    <button
        on:click={onStepClick}
        disabled={$loadedRomsStore.every((s) => s == undefined)}>Step</button
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
    <label
        >Use Boot
        <input
            type="checkbox"
            bind:checked={useBoot}
            disabled={$DebugSessionStarted}
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
