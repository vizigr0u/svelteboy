<script lang="ts">
    import {
        GbDebugInfoStore,
        ProgramRunning,
        DebugSessionStarted,
        LastStopReason,
        DebugFrames,
        Verbose,
    } from "../../stores/debugStores";
    import { loadedCartridge, loadedBootRom } from "../../stores/romStores";

    import {
        debugStep,
        debugPause,
        init,
        debugGetStatus,
        debugRunFrame,
        setJoypad,
        setVerbose,
    } from "../../../build/release";
    import { DebugStopReason, type GbDebugInfo } from "../../types";
    import { fetchLogs } from "../../debug";
    import { frameDelay, useBoot } from "../../stores/optionsStore";
    import { getInputForEmu } from "../../inputs";

    let breakSkipCount: number = 1;

    function debuggerRunOnFrame(): Promise<DebugStopReason> {
        return new Promise<DebugStopReason>((r) => {
            const keys = getInputForEmu();
            setJoypad(keys);
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
            const keys = getInputForEmu();
            setJoypad(keys);
            debugStep();
            fetchLogs();
            $ProgramRunning = false;
            resolve();
        });
    }

    function initDebug() {
        init($useBoot);
        setVerbose($Verbose);
        $DebugSessionStarted = true;
    }

    async function onStepClick() {
        if (!$DebugSessionStarted) {
            initDebug();
        }
        await debuggerStep();
        $GbDebugInfoStore = debugGetStatus() as GbDebugInfo;
    }

    async function onNextFrameClick() {
        if (!$DebugSessionStarted) {
            initDebug();
        }
        const _ = await debuggerRunOnFrame();
    }

    async function onIgnoreBreakClick() {
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
