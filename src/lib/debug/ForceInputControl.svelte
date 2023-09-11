<script lang="ts">
    import { KeyPressMap } from "stores/playStores";
    import { InputType } from "../../types";

    const controls = [
        InputType.A,
        InputType.B,
        InputType.Up,
        InputType.Down,
        InputType.Left,
        InputType.Right,
        InputType.Start,
        InputType.Select,
    ];
</script>

<div class="debug-tool-container">
    <h3>Force Inputs</h3>
    <div class="forced-inputs">
        {#each controls as control}
            <label>
                {InputType[control].split(".")[0]}
                <input
                    type="checkbox"
                    checked={$KeyPressMap.has(control)}
                    on:change={(ev) => {
                        if (ev.currentTarget.checked) $KeyPressMap.add(control);
                        else $KeyPressMap.delete(control);
                        $KeyPressMap = $KeyPressMap;
                    }}
                />
            </label>
        {/each}
    </div>
</div>

<style>
    .forced-inputs {
        display: flex;
        justify-content: space-around;
    }
</style>
