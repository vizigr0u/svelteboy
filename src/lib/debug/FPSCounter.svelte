<script lang="ts">
    import { onMount } from "svelte";
    import { GameFrames } from "../../stores/playStores";

    let lastDrawTime: number = 0;
    let updateFreq: number = 20;
    let fps: number = -1;

    onMount(() => {
        const unsub = GameFrames.subscribe((frame) => {
            if (frame != -1) {
                const frameEndTime = performance.now();
                if (lastDrawTime > 0 && frame % 10 == 0 && frame > 0) {
                    const lastFrameDuration = frameEndTime - lastDrawTime;
                    if (frame % updateFreq == 0) fps = 1000 / lastFrameDuration;
                }
                lastDrawTime = frameEndTime;
            }
        });
        return unsub;
    });
</script>

{#if fps >= 0}
    <span class="fps-counter-report">{fps.toFixed(1)}</span>
{/if}
