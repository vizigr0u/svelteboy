<script lang="ts">
    import { GbDebugInfoStore, DebuggerAttached } from "stores/debugStores";

    function fmt(n: bigint | undefined): string {
        if (n === undefined) return '—';
        const s = n.toString();
        if (s.length <= 4) return s;
        const head = s.slice(0, -3);
        return `${head}.${s.slice(-3, -2)}k`;
    }
</script>

<div class="hud-chip" title="CPU cycle count (debug attached only)">
    <span class="hud-chip-label">CYC</span>
    <span class="hud-chip-value mono">
        {#if $DebuggerAttached}{fmt($GbDebugInfoStore?.cycleCount)}{:else}—{/if}
    </span>
</div>
