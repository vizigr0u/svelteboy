<script lang="ts">
    import { loadedCartridge, loadedBootRom } from "stores/romStores";

    import { EmulatorPaused } from "stores/playStores";
    import { Emulator } from "../emulator";
    import QuickSaveControls from "./QuickSaveControls.svelte";

    async function onPlayPauseClick() {
        if ($EmulatorPaused) await Emulator.RunUntilBreak();
        else Emulator.Pause();
    }
</script>

<div class="player-control-buttons">
    <button
        on:click={onPlayPauseClick}
        disabled={$loadedBootRom == undefined && $loadedCartridge == undefined}
        >{$EmulatorPaused ? "Play" : "Pause"}</button
    >
</div>
<QuickSaveControls />

<style>
    .player-control-buttons {
        display: flex;
        align-items: center;
        justify-content: space-around;
    }
</style>
