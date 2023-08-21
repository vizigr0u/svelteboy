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
    import { GameFrames } from "../../stores/playStores";

    let verbose: number = 1;
    let useBoot: boolean = false;
    let frameDelay: number = 5;

    function runDebugger(): Promise<GbDebugInfo> {
        return new Promise<GbDebugInfo>((resolve) => {
            debugRunFrame();
            resolve(debugGetStatus() as GbDebugInfo);
        });
    }

    function debuggerStep(): Promise<GbDebugInfo> {
        return new Promise<GbDebugInfo>((resolve) => {
            $ProgramRunning = true;
            debugStep();
            fetchLogs();
            $ProgramRunning = false;
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
        $GbDebugInfoStore = await debuggerStep();
        $GameFrames = $GbDebugInfoStore.currentFrame;
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
        $GameFrames = $GbDebugInfoStore.currentFrame;
    }

    async function onRunPauseClick() {
        setVerbose(verbose);
        if ($ProgramRunning) {
            debugPause();
            fetchLogs();
            $ProgramRunning = false;
            $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
            $GameFrames = $GbDebugInfoStore.currentFrame;
        } else {
            if (!$DebugSessionStarted) {
                initDebug();
            }
            $GameFrames = 0;
            $ProgramRunning = true;
            do {
                $GbDebugInfoStore = await runDebugger();
                await fetchLogs();
                $GameFrames = $GbDebugInfoStore.currentFrame;
                await new Promise((resolve) => setTimeout(resolve, frameDelay));
            } while (
                $ProgramRunning &&
                ($GbDebugInfoStore == undefined ||
                    (!$GbDebugInfoStore.debug.stoppedByBreakpoint &&
                        !$GbDebugInfoStore.isStopped))
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
    <label
        >Frame delay
        <input
            type="number"
            class="verbose-input"
            bind:value={frameDelay}
            min="0"
            max="100"
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
