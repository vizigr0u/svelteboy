<script lang="ts">
    import {
        GbDebugInfoStore,
        ProgramRunning,
        DebugSessionStarted,
        LastStopReason,
        DebugFrames,
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
    import { frameDelay, useBoot } from "../../stores/optionsStore";

    let verbose: number = 1;
    let breakSkipCount: number = 1;

    function debuggerRunOnFrame(): Promise<DebugStopReason> {
        return new Promise<DebugStopReason>((r) => {
            const res = debugRunFrame();
            $DebugFrames++;
            fetchLogs();
            $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
            r(res);
        });
    }

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
    }

    async function onNextFrameClick() {
        setVerbose(verbose);
        if (!$DebugSessionStarted) {
            initDebug();
        }
        const _ = await debuggerRunOnFrame();
    }

    async function onIgnoreBreakClick() {
        setVerbose(verbose);
        if (!$DebugSessionStarted) {
            initDebug();
        }
        $ProgramRunning = true;
        let lastStopReason = DebugStopReason.None;
        for (let i = 0; i < breakSkipCount; i++) {
            do {
                lastStopReason = await debuggerRunOnFrame();
                if (lastStopReason == DebugStopReason.EndOfFrame)
                    await new Promise((r) => setTimeout(r, $frameDelay));
            } while (
                $ProgramRunning &&
                lastStopReason == DebugStopReason.EndOfFrame
            );
        }
        $LastStopReason = lastStopReason;
        $ProgramRunning = false;
        const _ = await debuggerRunOnFrame();
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
    }

    async function onRunPauseClick() {
        setVerbose(verbose);
        if ($ProgramRunning) {
            debugPause();
            fetchLogs();
            $ProgramRunning = false;
        } else {
            if (!$DebugSessionStarted) {
                initDebug();
            }
            $ProgramRunning = true;
            let lastStopReason = DebugStopReason.None;
            do {
                lastStopReason = await debuggerRunOnFrame();
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
    <button
        on:click={onNextFrameClick}
        disabled={$loadedBootRom == undefined && $loadedCartridge == undefined}
    >
        Next Frame
    </button>
    <div class="next-frame-group">
        <button
            on:click={onIgnoreBreakClick}
            disabled={$loadedBootRom == undefined &&
                $loadedCartridge == undefined}
            >{`Ignore ${breakSkipCount} break`}</button
        >
        <div class="next-frame-count-buttons">
            <button on:click={() => breakSkipCount++}>+</button>
            <button
                on:click={() => breakSkipCount--}
                disabled={breakSkipCount <= 1}>-</button
            >
        </div>
    </div>
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

    .verbose-input {
        max-width: 3em;
    }
</style>
