<script lang="ts">
    import { GbDebugInfoStore } from "../../stores/debugStores";

    export let flags: number;

    enum Flags {
        Z = 0b10000000,
        N = 0b01000000,
        H = 0b00100000,
        C = 0b00010000,
    }

    function hasFlag(f: Flags): boolean {
        return !!(flags & 0xff & Number(f));
    }
</script>

<div>
    CPU flags: {hasFlag(Flags.Z) ? "Z" : "-"}
    {hasFlag(Flags.N) ? "N" : "-"}
    {hasFlag(Flags.H) ? "H" : "-"}
    {hasFlag(Flags.C) ? "C" : "-"}
</div>

<style>
</style>
