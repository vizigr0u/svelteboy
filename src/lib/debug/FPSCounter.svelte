<script lang="ts">
    import { onMount } from "svelte";
    import { RenderFrames } from "../../emulator";
    import { GameFrames } from "stores/playStores";

    const WINDOW_MS = 500;
    let renderWindowStartTime: number = 0;
    let renderWindowStartFrame: number = -1;
    let gameWindowStartTime: number = 0;
    let gameWindowStartFrame: number = -1;
    let renderFps: number = -1;
    let gameFps: number = -1;

    function fmt(v: number): string {
        if (v >= 100) return v.toFixed(0);
        if (v >= 10) return v.toFixed(1);
        return v.toFixed(2);
    }

    onMount(() => {
        const unsubRender = RenderFrames.subscribe((frame) => {
            const now = performance.now();
            if (renderWindowStartFrame < 0) {
                renderWindowStartFrame = frame;
                renderWindowStartTime = now;
                return;
            }
            const elapsed = now - renderWindowStartTime;
            if (elapsed >= WINDOW_MS) {
                renderFps = ((frame - renderWindowStartFrame) * 1000) / elapsed;
                renderWindowStartFrame = frame;
                renderWindowStartTime = now;
            }
        });
        const unsubGame = GameFrames.subscribe((frame) => {
            const now = performance.now();
            if (gameWindowStartFrame < 0) {
                gameWindowStartFrame = frame;
                gameWindowStartTime = now;
                return;
            }
            const elapsed = now - gameWindowStartTime;
            if (elapsed >= WINDOW_MS) {
                gameFps = ((frame - gameWindowStartFrame) * 1000) / elapsed;
                gameWindowStartFrame = frame;
                gameWindowStartTime = now;
            }
        });
        return () => { unsubRender(); unsubGame(); };
    });
</script>

{#if renderFps >= 0}
    <span class="fps-counter-report">{fmt(renderFps)}r / {gameFps >= 0 ? fmt(gameFps) : "--"}g</span>
{/if}
