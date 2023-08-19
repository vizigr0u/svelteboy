<script lang="ts">
    import { measureCpuFrames } from "../../debug";

    let numFrames: number = 100;
    let maxCyclesPerFrame: number = 69903;
    let status: string = "";

    async function onButtonClick() {
        const frames = numFrames;
        status = "Benchmarking...";
        const result = await measureCpuFrames(frames);
        status =
            `Ran ${frames} frames in ${result}ms` +
            ` = ${(frames * 1000) / result} FPS`;
    }
</script>

<div class="benchmark-section debug-tool-container">
    <div class="benchmark-controls">
        <label>
            Frames
            <input type="number" bind:value={numFrames} min="1" max="5000" />
        </label>
        <label>
            Max Cycles per frame (Ref = 69903)
            <input
                type="number"
                bind:value={maxCyclesPerFrame}
                min="10000"
                max="500000"
            />
        </label>
        <button on:click={onButtonClick}>Benchmark</button>
    </div>
    <div class="benchmark-status">{status}</div>
</div>

<style>
    .benchmark-section {
        min-width: 38em;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }

    .benchmark-controls {
        display: flex;
    }

    .benchmark-status {
        background-color: #111;
    }
</style>
