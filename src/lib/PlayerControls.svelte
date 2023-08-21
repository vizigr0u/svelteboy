<script lang="ts">
    import { DebugSessionStarted } from "../stores/debugStores";
    import { loadedRomsStore } from "../stores/romStores";

    import { init, runOneFrame } from "../../build/release";
    import { GameFrames, GamePlaying } from "../stores/playStores";

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
                $GameFrames++;
                await new Promise((resolve) => setTimeout(resolve, frameDelay));
            } while ($GamePlaying);
        }
    }
</script>

<div class="debug-control-buttons">
    <button
        on:click={onRunStopClick}
        disabled={$DebugSessionStarted ||
            $loadedRomsStore.every((s) => s == undefined)}
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
    .debug-control-buttons {
        display: flex;
        align-items: center;
    }

    .verbose-input {
        max-width: 3em;
    }
</style>
