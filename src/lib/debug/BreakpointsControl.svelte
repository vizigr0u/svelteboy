<script lang="ts">
    import { Breakpoints } from "../../stores/debugStores";
    import { debugSetBreakpoint } from "../../../build/release";
    import { uToHex16 } from "../../utils";

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
            breakpointToAdd = "";
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

<div class="breakpoint-section">
    <h4 class="title">Breakpoints:</h4>
    <div class="breakpoint-info">
        <div class="add-breakpoint-form">
            <input
                class="address-input"
                type="text"
                bind:value={breakpointToAdd}
            />
            <button
                on:click={onAddClick}
                disabled={!strToAddress(breakpointToAdd)}
            >
                {strToAddress(breakpointToAdd)
                    ? "Add " + uToHex16(strToAddress(breakpointToAdd))
                    : "invalid"}
            </button>
        </div>
        {#each $Breakpoints.entries() as breakpoint}
            <div>
                0x{breakpoint[0].toString(16).padStart(4, "0")}
                <button on:click={() => onRemoveClick(breakpoint[0])}>-</button>
            </div>
        {/each}
    </div>
</div>

<style>
    .breakpoint-section {
        display: flex;
        flex-direction: column;
        text-align: center;
        align-items: center;
        gap: 1em;
    }
    .title {
        font-size: 1.1em;
        font-weight: 500;
    }
    .breakpoint-info {
        display: flex;
        flex-direction: column;
        justify-content: left;
        align-items: center;
        gap: 0.5em;
    }

    .add-breakpoint-form {
        display: flex;
    }
    .address-input {
        width: 4em;
    }
</style>
