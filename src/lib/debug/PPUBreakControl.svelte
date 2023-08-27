<script lang="ts">
    import { debugSetPPUBreak } from "../../../build/release";
    import { PPUMode } from "../../types";

    const breakModes = [
        PPUMode.HBlank,
        PPUMode.VBlank,
        PPUMode.OAMScan,
        PPUMode.Transfer,
    ];
</script>

<div class="ppu-breaks-section">
    <h4 class="title">Break on PPU:</h4>
    <div class="ppu-breaks-info">
        {#each breakModes as mode}
            <label>
                {PPUMode[mode]}
                <input
                    type="checkbox"
                    on:change={(ev) =>
                        debugSetPPUBreak(mode, ev.currentTarget.checked)}
                />
            </label>
        {/each}
    </div>
</div>

<style>
    .ppu-breaks-section {
        display: flex;
        flex-direction: column;
        text-align: center;
        align-items: center;
        gap: 0.2em;
        margin-bottom: 0.5em;
    }
    .title {
        font-size: 1.1em;
        font-weight: 500;
    }
    .ppu-breaks-info {
        display: flex;
        flex-direction: column;
        align-items: end;
    }
</style>
