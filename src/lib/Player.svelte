<script lang="ts">
    import { getGameFrame } from "../../build/release";
    import PlayerControls from "./PlayerControls.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
    import LcdCanvas from "./LcdCanvas.svelte";

    let pixelSize = 3;
</script>

<LcdCanvas
    updateBuffer={(buffer) => getGameFrame(buffer)}
    width={160}
    height={144}
    bind:pixelSize
/>
<label>
    Pixel size: <input type="number" min="1" max="10" bind:value={pixelSize} />
</label>
<PlayerControls />
<FpsCounter />
