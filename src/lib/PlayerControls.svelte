<script lang="ts">
    import { DebugSessionStarted } from "../stores/debugStores";
    import { loadedCartridge, loadedBootRom } from "../stores/romStores";

    import { init, runOneFrame } from "../../build/release";
    import { GameFrames, GamePlaying } from "../stores/playStores";
    import { fetchLogs } from "../debug";
    import { useBoot, frameDelay } from "../stores/optionsStore";

    async function onRunStopClick() {
        if ($GamePlaying) {
            $GamePlaying = false;
            $GameFrames = 0;
            init($useBoot);
        } else {
            $GamePlaying = true;
            $GameFrames = 0;
            init($useBoot);
            do {
                await new Promise<void>((r) => r(runOneFrame()));
                GameFrames.update((f) => f + 1);
                await fetchLogs();
                await new Promise((resolve) =>
                    setTimeout(resolve, $frameDelay)
                );
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
</div>

<style>
    .player-control-buttons {
        display: flex;
        align-items: center;
        justify-content: space-around;
    }
</style>
