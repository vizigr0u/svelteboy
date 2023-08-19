<script lang="ts">
    import { frameCount } from "../../stores/debugStores";

    let lastDrawTime: number = 0;
    let updateFreq: number = 20;
    let fps: number = -1;

    frameCount.subscribe((frame) => {
        if (frame != -1) {
            const frameEndTime = performance.now();
            if (lastDrawTime > 0 && frame % 10 == 0 && frame > 0) {
                const lastFrameDuration = frameEndTime - lastDrawTime;
                if (frame % updateFreq == 0) fps = 1000 / lastFrameDuration;
            }
            lastDrawTime = frameEndTime;
        }
    });
</script>

<div class="fps-counter">
    <h3>FPS counter</h3>
    {#if fps >= 0}
        <span class="fps-counter-report">{fps.toFixed(1)} FPS</span>
    {/if}
</div>

<style>
    .fps-counter {
        display: flex;
        align-items: center;
        justify-content: space-around;
    }
</style>
