<script lang="ts">
    import { onMount } from "svelte";
    import { RenderFrames } from "../../emulator";
    import { GameFrames } from "stores/playStores";

    const WINDOW_MS = 500;
    let renderStartTime = 0;
    let renderStartFrame = -1;
    let gameStartTime = 0;
    let gameStartFrame = -1;
    let renderFps = $state(-1);
    let gameFps = $state(-1);

    function fmt(v: number): string {
        if (v >= 100) return v.toFixed(0);
        if (v >= 10) return v.toFixed(1);
        return v.toFixed(2);
    }

    onMount(() => {
        const unsubRender = RenderFrames.subscribe((frame) => {
            const now = performance.now();
            if (renderStartFrame < 0) { renderStartFrame = frame; renderStartTime = now; return; }
            const elapsed = now - renderStartTime;
            if (elapsed >= WINDOW_MS) {
                renderFps = ((frame - renderStartFrame) * 1000) / elapsed;
                renderStartFrame = frame; renderStartTime = now;
            }
        });
        const unsubGame = GameFrames.subscribe((frame) => {
            const now = performance.now();
            if (gameStartFrame < 0) { gameStartFrame = frame; gameStartTime = now; return; }
            const elapsed = now - gameStartTime;
            if (elapsed >= WINDOW_MS) {
                gameFps = ((frame - gameStartFrame) * 1000) / elapsed;
                gameStartFrame = frame; gameStartTime = now;
            }
        });
        return () => { unsubRender(); unsubGame(); };
    });
</script>

<div class="hud-chip" title="Render FPS / Game FPS">
    <span class="hud-chip-label">FPS</span>
    <span class="hud-chip-value">
        {renderFps >= 0 ? fmt(renderFps) : '--'}<span class="hud-chip-unit">r</span>
        /
        {gameFps >= 0 ? fmt(gameFps) : '--'}<span class="hud-chip-unit">g</span>
    </span>
</div>
