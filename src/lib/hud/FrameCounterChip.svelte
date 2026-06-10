<script lang="ts">
    import { GameFrames } from "stores/playStores";
</script>

<div class="hud-chip" title="Frames since session start">
    <span class="hud-chip-label">F</span>
    <span class="hud-chip-value mono">{$GameFrames}</span>
</div>
