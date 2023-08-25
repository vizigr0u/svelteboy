<script lang="ts">
    import {
        DebugSessionStarted,
        GbDebugInfoStore,
    } from "../stores/debugStores";
    import { loadedCartridge, loadedBootRom } from "../stores/romStores";

    import { debugGetStatus, init, runOneFrame } from "../../build/release";
    import { GameFrames, GamePlaying } from "../stores/playStores";
    import { fetchLogs } from "../debug";
    import type { GbDebugInfo } from "../types";

    let useBoot: boolean = false;
    let frameDelay: number = 5;

    async function onRunStopClick() {
        if ($GamePlaying) {
            $GamePlaying = false;
        } else {
            $GamePlaying = true;
            $GameFrames = 0;
            init(useBoot);
            do {
                await new Promise<void>((r) => r(runOneFrame()));
                // $GbDebugInfoStore = (await debugGetStatus()) as GbDebugInfo;
                GameFrames.update((f) => f + 1);
                await fetchLogs();
                await new Promise((resolve) => setTimeout(resolve, frameDelay));
            } while ($GamePlaying);
        }
    }
</script>

<div class="player-control-buttons">
    <button
        on:click={onRunStopClick}
        disabled={$DebugSessionStarted ||
            ($loadedBootRom == undefined && $loadedCartridge == undefined)}
        >{$GamePlaying ? "Stop" : "Play"}</button
    >
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
    .player-control-buttons {
        display: flex;
        align-items: center;
        justify-content: space-around;
    }

    .verbose-input {
        max-width: 3em;
    }
</style>
