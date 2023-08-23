<script lang="ts">
    import { getGameFrame } from "../../build/release";
    import PlayerControls from "./PlayerControls.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
    import LcdCanvas from "./LcdCanvas.svelte";
</script>

<LcdCanvas
    updateBuffer={(buffer) => getGameFrame(buffer)}
    width={160}
    height={144}
/>
<PlayerControls />
<FpsCounter />
