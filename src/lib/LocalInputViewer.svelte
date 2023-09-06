<script lang="ts">
    import { InputType } from "../inputs";
    import { HideKeyboardWarning } from "../stores/optionsStore";
    import { KeyPressMap } from "../stores/playStores";
</script>

<div class="input-viewer">
    <div class="dir-viewer">
        <div class="up" class:pressed={$KeyPressMap.has(InputType.Up)} />
        <div class="left" class:pressed={$KeyPressMap.has(InputType.Left)} />
        <div class="right" class:pressed={$KeyPressMap.has(InputType.Right)} />
        <div class="down" class:pressed={$KeyPressMap.has(InputType.Down)} />
        <div class="center" />
    </div>
    <div class="special-key-viewer">
        <div
            class="select"
            class:pressed={$KeyPressMap.has(InputType.Select)}
        />
        <div class="start" class:pressed={$KeyPressMap.has(InputType.Start)} />
    </div>
    <div class="action-key-viewer">
        <div class="B" class:pressed={$KeyPressMap.has(InputType.B)} />
        <div class="A" class:pressed={$KeyPressMap.has(InputType.A)} />
    </div>
    {#if !$HideKeyboardWarning}
        <div class="keybinds-hint">
            Currently, only inputs are keyboard keys:
            <br />Up, Down, Left, Right, Shift(Select), Enter(Start), A and B.
            <br />
            I'll add something better later.
            <br />
            Maybe.
            <button
                class="dismiss-hint"
                on:click={() => {
                    $HideKeyboardWarning = true;
                }}><i class="fa-solid fa-xmark" /></button
            >
        </div>
    {/if}
</div>

<style>
    .input-viewer {
        position: relative;
        display: flex;
        justify-content: space-between;
        padding: 1em 10% 8em 4%;
        width: 100%;
    }

    .input-viewer > div > div.pressed {
        background-color: red;
    }

    .input-viewer > div > div::after {
        position: absolute;
        font-family: "Courier New", Courier, monospace;
        color: #12153d;
        font-weight: bold;
        font-size: 1em;
        text-transform: uppercase;
        text-align: center;
    }

    .dir-viewer {
        --size: 2em;
        align-self: flex-start;
        display: grid;
        background-color: #b2b2b2;
        border-radius: 50%;
        padding: 0.5em;
        grid-template-columns: repeat(3, var(--size));
        /* grid-template-rows: 100px 100px; */
        grid-template-areas:
            ". U ."
            "L C R"
            ". D .";
    }

    .dir-viewer > div {
        width: var(--size);
        height: var(--size);
        background-color: black;
    }

    .up {
        grid-area: U;
    }

    .down {
        grid-area: D;
    }

    .left {
        grid-area: L;
    }

    .right {
        grid-area: R;
    }

    .center {
        grid-area: C;
    }

    .special-key-viewer {
        display: flex;
        align-self: flex-end;
        gap: 1.5em;
        margin-top: 8em;
    }

    .special-key-viewer > div {
        position: relative;
        width: 3em;
        height: 0.8em;
        background-color: #555;
        border-radius: 8px;
        transform: rotate(-20deg);
    }

    .special-key-viewer > div::after {
        top: 0.7em;
        width: 3em;
    }

    .select::after {
        content: "Select";
    }

    .start::after {
        content: "Start";
    }

    .action-key-viewer {
        display: flex;
        gap: 1.3em;
        margin-top: 1.5em;
        align-self: flex-start;
        background-color: #aaa;
        border-radius: 2em;
        padding: 0.45em;
        font-size: 1.1em;
        transform: rotate(-20deg);
    }

    .action-key-viewer > div {
        --size: 2.5em;
        position: relative;
        width: var(--size);
        height: var(--size);
        border-radius: 50%;
        background-color: #5a1b36;
    }

    .action-key-viewer > div::after {
        top: calc(var(--size) + 0.3em);
        width: var(--size);
    }

    .A::after {
        content: "A";
    }

    .B::after {
        content: "B";
    }

    .input-viewer:hover .keybinds-hint {
        visibility: visible;
    }

    .keybinds-hint {
        position: absolute;
        padding: 1em 2em;
        background-color: #12153de7;
        border: 3px solid white;
        border-radius: 0.5em;
        width: 90%;
        visibility: hidden;
    }
    .dismiss-hint {
        position: absolute;
        right: 0.5em;
        top: 0.5em;
    }
</style>
