<script lang="ts">
    import { loadedCartridge, loadedBootRom } from "../stores/romStores";

    import { EmulatorPaused } from "../stores/playStores";
    import { pauseEmulator, runUntilBreak } from "../emulator";

    async function onPlayPauseClick() {
        if ($EmulatorPaused) await runUntilBreak();
        else pauseEmulator();
    }
</script>

<div class="player-control-buttons">
    <button
        on:click={onPlayPauseClick}
        disabled={$loadedBootRom == undefined && $loadedCartridge == undefined}
        >{$EmulatorPaused ? "Play" : "Pause"}</button
    >
</div>

<style>
    .player-control-buttons {
        display: flex;
        align-items: center;
        justify-content: space-around;
    }
</style>
