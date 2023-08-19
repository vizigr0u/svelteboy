<script lang="ts">
    import DebugValue from "./DebugValue.svelte";

    export let name: string;
    export let value: number;

    // const firstReg = () => ({ name: name.charAt(0), value: (value && 0xFF00) >> 8});
    // const secondReg = () => ({ name: name.charAt(1), value: value && 0xFF});
</script>

<div class="register">
    <div class="register-name">{name}</div>
    <DebugValue {value} byteSize={16} />
</div>

<style>
    .register-name {
        font-weight: 600;
    }
    .register {
        display: flex;
        gap: 1em;
    }
</style>
