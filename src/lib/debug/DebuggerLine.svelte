<script lang="ts">
    import { Debug } from "../../emulator";
    import { Breakpoints } from "../../stores/debugStores";
    import type { ProgramLine } from "../../types";

    export let line: ProgramLine;
    export let highlighted: boolean = false;

    let breakpoint: boolean = $Breakpoints.has(line.pc);

    function toggleBreakpoint() {
        if ($Breakpoints.has(line.pc)) $Breakpoints.delete(line.pc);
        else $Breakpoints.add(line.pc);
        Debug.SetBreakpoint(line.pc, $Breakpoints.has(line.pc));
        $Breakpoints = $Breakpoints;
        breakpoint = $Breakpoints.has(line.pc);
    }
</script>

<div class="program-line" class:highlighted>
    <button
        class="breakpoint-pill"
        class:breakpoint-enabled={$Breakpoints.has(line.pc)}
        on:click={toggleBreakpoint}
    />
    <span class="line-number">0x{line.pc.toString(16).padStart(4, "0")}</span>
    <span class="op">{line.op}</span>
    {#each line.parameters as op}
        <span class="operand">{op}</span>
    {/each}
    <span class="opcode">0x{line.opCode.toString(16).padStart(2, "0")}</span>
</div>

<style>
    .program-line {
        position: relative;
        display: flex;
        min-height: 1em;
        border-bottom: 1px solid rgb(38, 38, 38);
        font-family: "Courier New", Courier, monospace;
        width: 100%;
        align-items: center;
    }

    .program-line:hover {
        background-color: rgb(40, 40, 40);
    }

    .highlighted {
        background-color: rgb(36, 70, 46);
    }

    .program-line.highlighted::before {
        content: "➡";
        top: -0.15em;
        /* bottom: 0; */
        font-size: 1.4em;
        color: rgb(179, 179, 179);
        position: absolute;
    }

    .program-line.highlighted:hover {
        background-color: rgb(49, 78, 57);
    }

    .breakpoint-pill {
        z-index: 1;
        transition: unset;
        padding: 0;
        background-color: unset;
        margin-left: 0.4em;
        width: 0.8em;
        height: 0.8em;
        border-width: 1px;
        border-radius: 50%;
    }

    .program-line:hover .breakpoint-pill {
        border-color: red;
    }

    .breakpoint-enabled {
        background-color: red;
    }

    .line-number {
        user-select: none;
        width: 4em;
        text-align: right;
    }

    .op {
        color: rgb(251, 106, 153);
        width: 3em;
        margin-left: 2em;
    }

    .operand {
        color: rgb(146, 211, 239);
        margin-left: 1em;
    }
    .opcode {
        margin-left: auto;
        margin-right: 1em;
    }
</style>
