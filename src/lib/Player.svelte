<script lang="ts">
    import { getGameFrame } from "../../build/release";
    import PlayerControls from "./PlayerControls.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
    import LcdCanvas from "./LcdCanvas.svelte";
    import { playerPixelSize } from "../stores/optionsStore";
</script>

<LcdCanvas
    updateBuffer={(buffer) => getGameFrame(buffer)}
    width={160}
    height={144}
    bind:pixelSize={$playerPixelSize}
/>
<PlayerControls />
<FpsCounter />
