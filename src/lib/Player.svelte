<script lang="ts">
    import { getGameFrame } from "../../build/release";
    import PlayerControls from "./PlayerControls.svelte";
    import DebugLcd from "./debug/DebugLcd.svelte";
    import FpsCounter from "./debug/FPSCounter.svelte";
</script>

<DebugLcd draw={(buffer) => getGameFrame(buffer)} width={160} height={144} />
<PlayerControls />
<FpsCounter />
