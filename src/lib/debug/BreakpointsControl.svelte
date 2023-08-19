<script lang="ts">
    import { Breakpoints } from "../../stores/debugStores";
    import { debugSetBreakpoint } from "../../../build/release";

    let breakpointToAdd: string;

    function strToAddress(s: string): number | undefined {
        const breakpoint = parseInt(s, 16);
        if (isNaN(breakpoint) || breakpoint < 0 || breakpoint > 0xffff)
            return undefined;
        return breakpoint;
    }

    function onAddClick() {
        const breakpoint = parseInt(breakpointToAdd, 16);
        if (isNaN(breakpoint) || breakpoint < 0 || breakpoint > 0xffff) {
            console.log("invalid breakpoint value: " + breakpoint);
            return;
        }
        if (!$Breakpoints.has(breakpoint)) {
            debugSetBreakpoint(breakpoint);
            $Breakpoints.add(breakpoint);
            $Breakpoints = $Breakpoints;
            breakpointToAdd = "0";
        }
    }

    function onRemoveClick(breakpoint: number) {
        if ($Breakpoints.has(breakpoint)) {
            debugSetBreakpoint(breakpoint, false);
            $Breakpoints.delete(breakpoint);
            $Breakpoints = $Breakpoints;
        }
    }
</script>

<div class="debug-tool-container">
    <h4>Breakpoints:</h4>
    <div class="breakpoint-info">
        {#each $Breakpoints.entries() as breakpoint}
            <div>
                0x{breakpoint[0].toString(16).padStart(4, "0")}
                <button on:click={() => onRemoveClick(breakpoint[0])}>-</button>
            </div>
        {/each}
        <div>
            <input type="text" bind:value={breakpointToAdd} />{strToAddress(
                breakpointToAdd
            )
                ? "0x" +
                  strToAddress(breakpointToAdd).toString(16).padStart(4, "0")
                : "invalid"}
            <button on:click={onAddClick}>+</button>
        </div>
    </div>
</div>
