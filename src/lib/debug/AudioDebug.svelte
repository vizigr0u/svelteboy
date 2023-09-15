<script lang="ts">
    import { AudioAnalyzerNode } from "@/stores/debugStores";
    import { EmulatorPaused } from "@/stores/playStores";
    import { onMount } from "svelte";

    let pixelScale: number = 1;
    let canvas: HTMLCanvasElement;

    const WIDTH = 1024;
    const HEIGHT = 256;
    let bufferLength;
    let dataArray;
    let canvasCtx: CanvasRenderingContext2D;
    let rafRef = 0;

    onMount(() => {
        const unsub = AudioAnalyzerNode.subscribe((analyser) => {
            if (analyser == undefined) {
                window.cancelAnimationFrame(rafRef);
                return;
            }
            canvasCtx = canvas.getContext("2d");
            analyser.fftSize = 2048;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            rafRef = window.requestAnimationFrame(draw);
        });
        return () => {
            unsub();
            window.cancelAnimationFrame(rafRef);
        };
    });

    function draw() {
        const analyser = $AudioAnalyzerNode;

        if (analyser == undefined) return;
        analyser.getByteTimeDomainData(dataArray);

        if (!$EmulatorPaused) {
            canvasCtx.fillStyle = "rgb(20, 20, 20)";
            canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = "rgb(90, 255, 150)";
            canvasCtx.beginPath();
            const sliceWidth = WIDTH / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * (HEIGHT / 2);

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }
            canvasCtx.lineTo(WIDTH, HEIGHT / 2);
            canvasCtx.stroke();
        }

        rafRef = window.requestAnimationFrame(draw);
    }
</script>

<div class="canvas-container">
    <canvas
        class="canvas"
        style="width: {WIDTH}px; height: {HEIGHT}px"
        bind:this={canvas}
        width={WIDTH}
        height={HEIGHT}
    />
</div>

<style>
    .canvas-container {
        background-color: #1f1f1f;
        padding: 2em;
    }

    .canvas {
        border: 1px solid black;
    }
</style>
