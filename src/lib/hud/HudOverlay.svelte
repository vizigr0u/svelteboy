<script lang="ts">
    import { HudStore } from "stores/hudStore";
    import FpsChip from "./FpsChip.svelte";
    import FrameCounterChip from "./FrameCounterChip.svelte";
    import InputDisplayChip from "./InputDisplayChip.svelte";
    import CpuChip from "./CpuChip.svelte";

    let cfg = $derived($HudStore);
    let position = $derived(cfg.position);
    let anyEnabled = $derived(Object.values(cfg.enabled).some(v => v));
</script>

{#if anyEnabled}
    <div class="hud-overlay hud-{position}" aria-hidden="true">
        {#if cfg.enabled.fps}<FpsChip />{/if}
        {#if cfg.enabled.frame}<FrameCounterChip />{/if}
        {#if cfg.enabled.cpu}<CpuChip />{/if}
        {#if cfg.enabled.input}<InputDisplayChip />{/if}
    </div>
{/if}

<style>
    .hud-overlay {
        position: absolute;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px;
        pointer-events: none;
        z-index: 6;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    }
    .hud-tl { top: 0; left: 0; align-items: flex-start; }
    .hud-tr { top: 0; right: 0; align-items: flex-end; }
    .hud-bl { bottom: 0; left: 0; align-items: flex-start; }
    .hud-br { bottom: 0; right: 0; align-items: flex-end; }

    :global(.hud-overlay .hud-chip) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 18px;
        padding: 2px 6px;
        background: rgba(0, 0, 0, 0.6);
        color: rgba(255, 255, 255, 0.85);
        border-radius: 4px;
        font-size: 11px;
        line-height: 1;
        backdrop-filter: blur(2px);
    }
    :global(.hud-overlay .hud-chip-label) {
        font-size: 9px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.55;
    }
    :global(.hud-overlay .hud-chip-value) {
        font-variant-numeric: tabular-nums;
    }
    :global(.hud-overlay .hud-chip-value.mono) {
        font-family: ui-monospace, monospace;
    }
    :global(.hud-overlay .hud-chip-unit) {
        opacity: 0.5;
        font-size: 9px;
        margin: 0 1px;
    }
</style>
