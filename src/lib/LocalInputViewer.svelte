<script lang="ts">
    import { onMount } from "svelte";
    import { InputType, updateInput } from "../inputs";
    import { HideKeyboardWarning, KeyBindingsStore } from "stores/optionsStore";
    import { KeyPressMap } from "stores/playStores";
    import { displayKey } from "../keybindPresets";

    let buttonContainer: HTMLElement;
    let hintVisible = $state(false);
    let userInteracted = false;

    let buttons: NodeListOf<HTMLButtonElement>;
    let inputsByButton: Map<HTMLButtonElement, InputType>;

    function showHint() { userInteracted = true; hintVisible = true; }
    function hideHint() { userInteracted = true; hintVisible = false; $HideKeyboardWarning = true; }

    function getInputTypeForButton(b: HTMLButtonElement): InputType {
        return InputType[
            b.getAttribute("data-input") as keyof typeof InputType
        ];
    }

    onMount(() => {
        buttons = buttonContainer.querySelectorAll<HTMLButtonElement>("button[data-input]");
        const InputsAndButtons = Array.from(buttons).map(
            (b) =>
                [b, getInputTypeForButton(b)] as [HTMLButtonElement, InputType]
        );
        inputsByButton = new Map<HTMLButtonElement, InputType>(InputsAndButtons);
        buttons.forEach((button) => {
            const input = inputsByButton.get(button)!;
            button.ontouchstart = () => updateInput(input, true);
            button.onmousedown = () => updateInput(input, true);
            button.onmouseup = () => updateInput(input, false);
            button.onblur = () => updateInput(input, false);
            button.onmouseleave = () => updateInput(input, false);
            button.ontouchend = () => updateInput(input, false);
            button.ontouchcancel = () => updateInput(input, false);
        });
    });

    $effect(() => {
        if (!buttons) return;
        const inputs = $KeyPressMap;
        buttons.forEach((button) => {
            button.classList.toggle("pressed", inputs.has(inputsByButton.get(button)!));
        });
    });

    $effect(() => {
        if (!userInteracted) hintVisible = !$HideKeyboardWarning;
    });
</script>

<div class="input-viewer" bind:this={buttonContainer}>
    <div class="dir-viewer">
        <button data-input="Up" aria-label="Up"></button>
        <button data-input="Left" aria-label="Left"></button>
        <button data-input="Right" aria-label="Right"></button>
        <button data-input="Down" aria-label="Down"></button>
        <div class="center"></div>
    </div>
    <div class="special-key-viewer">
        <button data-input="Select" aria-label="Select"></button>
        <button data-input="Start" aria-label="Start"></button>
    </div>
    <div class="action-key-viewer">
        <button data-input="B" aria-label="B"></button>
        <button data-input="A" aria-label="A"></button>
    </div>
    <div
        class="hint-container"
        class:expanded={hintVisible}
        role="button"
        tabindex="0"
        aria-label={hintVisible ? 'Dismiss controls hint' : 'Show controls hint'}
        onclick={hintVisible ? hideHint : showHint}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') hintVisible ? hideHint() : showHint(); }}
    >
        <span class="toggle-icon" aria-hidden="true">?</span>
        <div class="hint-content">
            Keyboard controls:
            <br />{displayKey($KeyBindingsStore.up)}{displayKey($KeyBindingsStore.down)}{displayKey($KeyBindingsStore.left)}{displayKey($KeyBindingsStore.right)} for D-Pad &nbsp;·&nbsp;
            {displayKey($KeyBindingsStore.a)} for A &nbsp;·&nbsp;
            {displayKey($KeyBindingsStore.b)} for B &nbsp;·&nbsp;
            {displayKey($KeyBindingsStore.select)} for Select &nbsp;·&nbsp;
            Enter for Start
            <br /><span class="hint-sub">Click to dismiss · Change bindings in Options.</span>
        </div>
    </div>
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

    .hint-container {
        position: absolute;
        bottom: 1em;
        left: 1em;
        width: 1.7em;
        min-height: 1.7em;
        border-radius: 50%;
        border: 2px solid #aaa;
        background: #12153d99;
        padding: 1.3em;
        color: #aaa;
        cursor: pointer;
        overflow: hidden;
        transition: width 100ms ease, border-radius 100ms ease,
                    padding 100ms ease, border-color 100ms ease,
                    color 100ms ease;
    }
    .hint-container.expanded {
        width: calc(100% - 2em);
        border-radius: 0.5em 0.5em 5em 0.5em;
        border-color: white;
        background: #12153de7;
        color: inherit;
        padding: 4em 2em;
    }
    .hint-container:not(.expanded):hover {
        background: #12153de7;
        border-color: white;
        color: white;
    }
    .toggle-icon {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4em;
        font-weight: bold;
        transition: opacity 150ms ease;
        pointer-events: none;
    }
    .hint-container.expanded .toggle-icon {
        opacity: 0;
    }
    .hint-content {
        max-height: 0;
        overflow: hidden;
        font-size: 1.5em;
        opacity: 0;
        transition: max-height 100ms ease, opacity 100ms ease 100ms;
    }
    .hint-container.expanded .hint-content {
        max-height: 10em;
        opacity: 1;
    }
    .hint-sub {
        opacity: 0.65;
        font-size: 0.85em;
    }
    @media (prefers-reduced-motion: reduce) {
        .hint-container,
        .toggle-icon,
        .hint-content {
            transition: none;
        }
    }

    :global(.input-viewer button.pressed) {
        background-color: red !important;
    }
</style>
