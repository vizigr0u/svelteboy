<script lang="ts">
    import { onMount } from "svelte";

    let status: string = "";

    let soundTimeSeconds = 2;

    const channels = 2;

    let audioCtx: AudioContext;
    let audioBuffer: AudioBuffer;

    onMount(() => {
        audioCtx = new window.AudioContext();
        const frameCount = audioCtx.sampleRate * soundTimeSeconds;
        audioBuffer = audioCtx.createBuffer(2, frameCount, audioCtx.sampleRate);
    });

    function fillFromWasm(size: number): Float32Array {
        // audioFillBuffers(size);
        // return audioGetLeft();
        return new Float32Array(size);
    }

    type MakeBuffer = (size: number) => Float32Array;

    function fillAndPlay(
        event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
    ) {
        // Get an AudioBufferSourceNode.
        // This is the AudioNode to use when we want to play an AudioBuffer
        const source = audioCtx.createBufferSource();

        let make: MakeBuffer = fillFromWasm;
        const left = make(audioBuffer.length);
        const right = new Float32Array(left.length);
        new Uint8Array(right).set(new Uint8Array(left));
        audioBuffer.copyToChannel(left, 0, 0);
        audioBuffer.copyToChannel(right, 1, 0);

        // set the buffer in the AudioBufferSourceNode
        source.buffer = audioBuffer;

        // connect the AudioBufferSourceNode to the
        // destination so we can hear the sound
        source.connect(audioCtx.destination);

        // start the source playing
        source.start();
    }
</script>

<div style="display: flex; flex-direction: column;">
    <button on:click={fillAndPlay}>Play New</button>
    <label
        >Time: <input type="range" min="0.1" max="10" />{soundTimeSeconds} seconds</label
    >
    <span>{status}</span>
</div>
