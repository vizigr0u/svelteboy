<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { FrameStats, FRAME_TIMES_LEN } from "../../emulator";
    import { GameFrames } from "stores/playStores";

    const W = FRAME_TIMES_LEN;
    const H = 60;
    const TARGET_60_MS = 1000 / 60;
    const TARGET_30_MS = 1000 / 30;
    const MAX_MS = 50;
    const GAME_FPS_WINDOW_MS = 500;

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let raf = 0;

    let fpsText = "--";
    let gameFpsText = "--";
    let p50Text = "--";
    let p99Text = "--";
    let droppedText = "0";

    let gameWindowStartTime = 0;
    let gameWindowStartFrame = -1;
    const unsubGame = GameFrames.subscribe((frame) => {
        const now = performance.now();
        if (gameWindowStartFrame < 0) {
            gameWindowStartFrame = frame;
            gameWindowStartTime = now;
            return;
        }
        const elapsed = now - gameWindowStartTime;
        if (elapsed >= GAME_FPS_WINDOW_MS) {
            const fps = ((frame - gameWindowStartFrame) * 1000) / elapsed;
            gameFpsText = fps >= 100 ? fps.toFixed(0) : fps >= 10 ? fps.toFixed(1) : fps.toFixed(2);
            gameWindowStartFrame = frame;
            gameWindowStartTime = now;
        }
    });

    function colorFor(ms: number): string {
        if (ms < TARGET_60_MS) return "#3a3";
        if (ms < 20) return "#cc3";
        return "#c33";
    }

    function quantile(sorted: Float32Array, q: number): number {
        if (sorted.length === 0) return 0;
        const i = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
        return sorted[i];
    }

    function draw() {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, W, H);

        const buf = FrameStats.frameTimesMs;
        const idx = FrameStats.writeIndex;
        const valid = Math.min(FrameStats.totalWrites, FRAME_TIMES_LEN);

        const y60 = H - (TARGET_60_MS / MAX_MS) * H;
        const y30 = H - (TARGET_30_MS / MAX_MS) * H;
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y60); ctx.lineTo(W, y60);
        ctx.moveTo(0, y30); ctx.lineTo(W, y30);
        ctx.stroke();

        for (let i = 0; i < valid; i++) {
            const sample = buf[(idx - valid + i + FRAME_TIMES_LEN) % FRAME_TIMES_LEN];
            const h = Math.min(H, (sample / MAX_MS) * H);
            ctx.fillStyle = colorFor(sample);
            ctx.fillRect(W - valid + i, H - h, 1, h);
        }

        if (valid > 0) {
            const sorted = new Float32Array(valid);
            for (let i = 0; i < valid; i++) sorted[i] = buf[i];
            sorted.sort();
            const p50 = quantile(sorted, 0.5);
            const p99 = quantile(sorted, 0.99);

            const last = Math.min(60, valid);
            let sum = 0;
            for (let i = 0; i < last; i++) {
                sum += buf[(idx - 1 - i + FRAME_TIMES_LEN) % FRAME_TIMES_LEN];
            }
            const avgMs = sum / last;
            fpsText = avgMs > 0 ? (1000 / avgMs).toFixed(1) : "--";
            p50Text = p50.toFixed(1);
            p99Text = p99.toFixed(1);
            droppedText = String(FrameStats.droppedCount);
        }

        raf = requestAnimationFrame(draw);
    }

    onMount(() => {
        ctx = canvas.getContext("2d")!;
        raf = requestAnimationFrame(draw);
    });

    onDestroy(() => {
        cancelAnimationFrame(raf);
        unsubGame();
    });
</script>

<div class="frametime-widget">
    <canvas bind:this={canvas} width={W} height={H}></canvas>
    <div class="stats">
        <span>{fpsText}r / {gameFpsText}g fps</span>
        <span>p50 {p50Text}ms</span>
        <span>p99 {p99Text}ms</span>
        <span>drop {droppedText}</span>
    </div>
</div>

<style>
    .frametime-widget {
        background: rgba(0, 0, 0, 0.75);
        color: #ddd;
        font-family: monospace;
        font-size: 0.7em;
        padding: 0.3em;
        border-radius: 0.3em;
        pointer-events: none;
    }
    canvas {
        display: block;
        image-rendering: pixelated;
    }
    .stats {
        display: flex;
        gap: 0.6em;
        padding-top: 0.2em;
        white-space: nowrap;
    }
</style>
