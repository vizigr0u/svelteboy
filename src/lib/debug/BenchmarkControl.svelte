<script lang="ts">
    import { benchmarkFrames } from "../../debug";

    let numFrames: number = 60;
    let status: string = "";
    let running: boolean = false;

    async function onButtonClick() {
        if (running) return;
        const frames = numFrames;
        running = true;
        status = "Benchmarking...";
        const result = await benchmarkFrames(frames);
        running = false;
        if (!result.ok) {
            status = result.error;
            return;
        }
        const fps = result.fps.toFixed(1);
        const ms = result.ms.toFixed(1);
        status = `${fps} FPS  (${result.frames} frames in ${ms} ms)`;
    }
</script>

<div class="benchmark-section debug-tool-container">
    <h3>Benchmark</h3>
    <div class="benchmark-controls">
        <label>
            Frames
            <input
                type="number"
                bind:value={numFrames}
                min="1"
                max="5000"
                disabled={running}
            />
        </label>
        <button onclick={onButtonClick} disabled={running}>
            {running ? "Running..." : "Benchmark"}
        </button>
        <span class="benchmark-status">{status}</span>
    </div>
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
        align-items: center;
        gap: 1em;
    }

    .benchmark-status {
        background-color: #111;
        padding: 0.25em 0.5em;
        font-family: monospace;
        flex: 1;
    }
</style>
