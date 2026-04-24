<script lang="ts">
    import { onMount } from "svelte";
    import { GameFrames } from "stores/playStores";

    const WINDOW = 30;
    let windowStartTime: number = 0;
    let windowStartFrame: number = -1;
    let fps: number = -1;

    onMount(() => {
        const unsub = GameFrames.subscribe((frame) => {
            const now = performance.now();
            if (windowStartFrame < 0) {
                windowStartFrame = frame;
                windowStartTime = now;
                return;
            }
            const elapsed = now - windowStartTime;
            const count = frame - windowStartFrame;
            if (count >= WINDOW && elapsed > 0) {
                fps = (count * 1000) / elapsed;
                windowStartFrame = frame;
                windowStartTime = now;
            }
        });
        return unsub;
    });
</script>

{#if fps >= 0}
    <span class="fps-counter-report">{fps.toFixed(1)}</span>
{/if}
