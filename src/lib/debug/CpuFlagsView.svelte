<script lang="ts">
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

{#key flags}
    <div class="flags-view">
        <div class="flag-view">
            <span>Z</span>
            <input type="checkbox" checked={hasFlag(Flags.Z)} disabled={true} />
        </div>
        <div class="flag-view">
            <span>N</span><input
                type="checkbox"
                checked={hasFlag(Flags.N)}
                disabled={true}
            />
        </div>
        <div class="flag-view">
            <span>H</span><input
                type="checkbox"
                checked={hasFlag(Flags.H)}
                disabled={true}
            />
        </div>
        <div class="flag-view">
            <span>C</span><input
                type="checkbox"
                checked={hasFlag(Flags.C)}
                disabled={true}
            />
        </div>
        <div class="flag-values" />
    </div>
{/key}

<style>
    .flags-view {
        display: flex;
        font-weight: 600;
        gap: 0.4em;
    }

    .flag-view {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
</style>
