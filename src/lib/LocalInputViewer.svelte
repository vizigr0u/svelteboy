<script lang="ts">
    import { onMount } from "svelte";
    import { InputType, updateInput } from "../inputs";
    import { HideKeyboardWarning } from "../stores/optionsStore";
    import { KeyPressMap } from "../stores/playStores";

    let buttonContainer: HTMLElement;

    function getInputTypeForButton(b: HTMLButtonElement): InputType {
        return InputType[
            b.getAttribute("data-input") as keyof typeof InputType
        ];
    }

    onMount(() => {
        const buttons = buttonContainer.querySelectorAll("button");
        const InputsAndButtons = Array.from(buttons).map(
            (b) =>
                [b, getInputTypeForButton(b)] as [HTMLButtonElement, InputType]
        );
        const inputsByButton = new Map<HTMLButtonElement, InputType>(
            InputsAndButtons
        );
        buttons.forEach((button) => {
            const input = inputsByButton.get(button);
            button.onmousedown = () => {
                updateInput(input, true);
            };
            button.onmouseup = () => updateInput(input, false);
            button.onblur = () => updateInput(input, false);
            button.onmouseleave = () => updateInput(input, false);
        });
        const unsub = KeyPressMap.subscribe((inputs) => {
            buttons.forEach((button) => {
                const input = inputsByButton.get(button);
                button.classList.toggle("pressed", inputs.has(input));
            });
        });
        return unsub;
    });
</script>

<div class="input-viewer" bind:this={buttonContainer}>
    <div class="dir-viewer">
        <button data-input="Up" />
        <button data-input="Left" />
        <button data-input="Right" />
        <button data-input="Down" />
        <div class="center" />
    </div>
    <div class="special-key-viewer">
        <button data-input="Select" />
        <button data-input="Start" />
    </div>
    <div class="action-key-viewer">
        <button data-input="B" />
        <button data-input="A" />
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

    .input-viewer button {
        font-size: initial;
    }

    .input-viewer button::after {
        position: absolute;
        font-family: "Courier New", Courier, monospace;
        color: #12153d;
        font-weight: bold;
        font-size: 1em;
        text-transform: uppercase;
        text-align: center;
        content: attr(data-input);
        left: 0;
    }

    .dir-viewer {
        --size: 2.3em;
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

    .dir-viewer button::after {
        content: none;
    }

    .dir-viewer > button,
    .dir-viewer > .center {
        width: var(--size);
        height: var(--size);
        background-color: black;
    }

    button[data-input="Up"] {
        grid-area: U;
    }

    button[data-input="Down"] {
        grid-area: D;
    }

    button[data-input="Left"] {
        grid-area: L;
    }

    button[data-input="Right"] {
        grid-area: R;
    }

    .center {
        grid-area: C;
    }

    .special-key-viewer {
        display: flex;
        align-self: flex-end;
        gap: 2em;
        margin-top: 8em;
    }

    .special-key-viewer > button {
        position: relative;
        --size: 3em;
        width: var(--size);
        height: 0.8em;
        background-color: #555;
        border-radius: 8px;
        transform: rotate(-20deg);
    }

    .special-key-viewer > button::after {
        top: 0.7em;
        width: var(--size);
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

    .action-key-viewer > button {
        --size: 2.5em;
        position: relative;
        width: var(--size);
        height: var(--size);
        border-radius: 50%;
        background-color: #5a1b36;
    }

    .action-key-viewer > button::after {
        font-size: 1.1em;
        top: calc(var(--size) + 0.3em);
        width: calc(var(--size) + 0.3em);
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

    :global(.input-viewer button.pressed) {
        background-color: red !important;
    }
</style>
