<script lang="ts">
    export let value: number;
    export let byteSize: number = 16;
</script>

<div class="debug-value">
    <div class="register-value value-hex">
        0x{value.toString(16).padStart(byteSize == 16 ? 4 : 2, "0")}
    </div>
    <div class="register-value value-dec">({value})</div>
</div>

<style>
    .debug-value {
        display: flex;
        align-items: center;
        font-family: "Courier New", Courier, monospace;
        /* gap: 0.1em; */
    }

    .register-value {
        min-width: 5em;
    }
    .value-dec {
        font-size: small;
    }
</style>
