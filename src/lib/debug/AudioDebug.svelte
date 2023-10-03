<script lang="ts">
    import { Debug } from "@/emulator";
    import {
        AudioAnalyzerNode,
        AudioBufferPointers,
    } from "@/stores/debugStores";
    import { EmulatorPaused } from "@/stores/playStores";
    import { onMount } from "svelte";

    let pixelScale: number = 1;
    let leftCanvas: HTMLCanvasElement;
    let rightCanvas: HTMLCanvasElement;
    let analyserCanvas: HTMLCanvasElement;

    let pointerIndex: number = -1;

    const WIDTH = 512;
    const HEIGHT = 128;
    let bufferLength;
    let analyserArray: Float32Array;
    let AnalyzsercanvasCtx: CanvasRenderingContext2D;
    let leftCanvasCtx: CanvasRenderingContext2D;
    let rightCanvasCtx: CanvasRenderingContext2D;
    let rafRef = 0;

    onMount(() => {
        const unsubAnalyser = AudioAnalyzerNode.subscribe((analyser) => {
            if (analyser == undefined) {
                window.cancelAnimationFrame(rafRef);
                return;
            }
            leftCanvasCtx = leftCanvas.getContext("2d");
            rightCanvasCtx = rightCanvas.getContext("2d");
            AnalyzsercanvasCtx = analyserCanvas.getContext("2d");
            analyser.fftSize = 2048;
            bufferLength = analyser.frequencyBinCount;
            analyserArray = new Float32Array(bufferLength);
            rafRef = window.requestAnimationFrame(draw);
        });
        const unsubPointers = AudioBufferPointers.subscribe((ptrs) => {
            pointerIndex =
                ptrs.length > 0
                    ? Math.max(0, Math.min(ptrs.length - 1, pointerIndex))
                    : -1;
        });
        return () => {
            unsubAnalyser();
            unsubPointers();
            window.cancelAnimationFrame(rafRef);
        };
    });

    function draw() {
        const analyser = $AudioAnalyzerNode;

        if (analyser == undefined) return;
        analyser.getFloatTimeDomainData(analyserArray);

        if (!$EmulatorPaused) {
            renderBuffer(analyserArray, AnalyzsercanvasCtx);
        }

        const ptrs = $AudioBufferPointers;
        if (ptrs.length > 0 && pointerIndex >= 0) {
            const safeIdx = Math.min(ptrs.length - 1, pointerIndex);
            const left = Debug.GetAudioBufferFromPtr(ptrs[safeIdx][0]);
            const right = Debug.GetAudioBufferFromPtr(ptrs[safeIdx][1]);
            renderBuffer(left, leftCanvasCtx);
            renderBuffer(right, rightCanvasCtx);
        }

        rafRef = window.requestAnimationFrame(draw);
    }

    function renderBuffer(buffer: Float32Array, ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "rgb(20, 20, 20)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgb(90, 255, 150)";
        ctx.beginPath();
        const sliceWidth = WIDTH / buffer.length;
        let x = 0;

        for (let i = 0; i < buffer.length; i++) {
            const y = ((buffer[i] + 1) / 2) * HEIGHT;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }
        // ctx.lineTo(WIDTH, HEIGHT / 2);
        ctx.stroke();
    }
</script>

<div class="canvases-container">
    <input
        type="number"
        min={-1}
        max={$AudioBufferPointers.length > 0
            ? $AudioBufferPointers.length - 1
            : 0}
        bind:value={pointerIndex}
    />
    <div class="canvas-container">
        <span>LEFT</span>
        <canvas
            class="canvas"
            style="width: {WIDTH * pixelScale}px; height: {HEIGHT *
                pixelScale}px"
            bind:this={leftCanvas}
            width={WIDTH}
            height={HEIGHT}
        />
    </div>
    <div class="canvas-container">
        <span>RIGHT</span>
        <canvas
            class="canvas"
            style="width: {WIDTH * pixelScale}px; height: {HEIGHT *
                pixelScale}px"
            bind:this={rightCanvas}
            width={WIDTH}
            height={HEIGHT}
        />
    </div>
    <div class="canvas-container">
        <span>OUT</span>
        <canvas
            class="canvas"
            style="width: {WIDTH * pixelScale}px; height: {HEIGHT *
                pixelScale}px"
            bind:this={analyserCanvas}
            width={WIDTH}
            height={HEIGHT}
        />
    </div>
</div>

<style>
    .canvases-container {
        background-color: var(--section-bg-color);
        padding: 2em;
        display: flex;
        flex-direction: column;
    }

    .canvas-container {
        display: flex;
        flex-direction: column;
    }

    .canvas-container > span {
        text-align: center;
    }

    .canvas {
        border: 1px solid black;
    }
</style>
