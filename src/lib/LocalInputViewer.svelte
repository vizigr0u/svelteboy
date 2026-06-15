<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { InputType, updateInput } from "../inputs";
    import { HapticsEnabled } from "stores/optionsStore";
    import { KeyPressMap } from "stores/playStores";

    let { mode = 'bar', hideActions = false }: { mode?: 'bar' | 'sides'; hideActions?: boolean } = $props();

    let buttonContainer: HTMLElement;

    let buttons: NodeListOf<HTMLButtonElement>;
    let inputsByButton: Map<HTMLButtonElement, InputType>;

    function getInputTypeForButton(b: HTMLButtonElement): InputType {
        return InputType[
            b.getAttribute("data-input") as keyof typeof InputType
        ];
    }

    function buzz(ms: number = 8): void {
        if (!get(HapticsEnabled)) return;
        if (typeof navigator === "undefined" || !navigator.vibrate) return;
        navigator.vibrate(ms);
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
            button.ontouchstart = () => { updateInput(input, true); buzz(); };
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
</script>

<div class="input-viewer" class:sides={mode === 'sides'} class:hide-actions={hideActions} bind:this={buttonContainer}>
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
</div>

<style>
    .input-viewer {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        --pad: 11cqmin;
        --action: 13cqmin;
        --special: 12cqmin;
        padding: 3cqmin 4cqmin calc(4cqmin + env(safe-area-inset-bottom));
        gap: 3cqmin;
        width: 100%;
        user-select: none;
        -webkit-user-select: none;
    }

    .input-viewer button {
        font-family: ui-sans-serif, system-ui, sans-serif;
        border: none;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.85);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    /* D-Pad: cross shape, dark plate */
    .dir-viewer {
        justify-self: start;
        display: grid;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 1.5cqmin;
        padding: 1cqmin;
        grid-template-columns: repeat(3, var(--pad));
        grid-template-rows: repeat(3, var(--pad));
        grid-template-areas:
            ". U ."
            "L C R"
            ". D .";
    }
    .dir-viewer > button,
    .dir-viewer > .center {
        background: #2a2a3a;
        border-radius: 1cqmin;
    }
    .dir-viewer > .center {
        background: rgba(255, 255, 255, 0.08);
    }
    .dir-viewer > button::after { content: none; }
    .dir-viewer > button:active {
        background: var(--highlight-color, #89b4fa);
    }
    button[data-input="Up"] { grid-area: U; }
    button[data-input="Down"] { grid-area: D; }
    button[data-input="Left"] { grid-area: L; }
    button[data-input="Right"] { grid-area: R; }
    .center { grid-area: C; }

    /* Start / Select: flat pills, no rotation */
    .special-key-viewer {
        justify-self: center;
        display: flex;
        gap: 3cqmin;
        align-self: end;
    }
    .special-key-viewer > button {
        position: relative;
        height: var(--special);
        min-width: 16cqmin;
        padding: 0 3cqmin;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 999px;
        font-size: 3cqmin;
        color: rgba(255, 255, 255, 0.7);
    }
    .special-key-viewer > button::after {
        content: attr(data-input);
        position: relative;
    }

    /* A / B: flat circles, accent color, B left A right */
    .action-key-viewer {
        justify-self: end;
        display: flex;
        gap: 3cqmin;
        align-items: flex-end;
    }
    .action-key-viewer > button {
        position: relative;
        width: var(--action);
        height: var(--action);
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
        border: 2px solid rgba(255, 255, 255, 0.18);
        font-size: 5cqmin;
        color: rgba(255, 255, 255, 0.9);
    }
    .action-key-viewer > button::after {
        content: attr(data-input);
        position: relative;
    }
    .action-key-viewer > button[data-input="A"] {
        margin-bottom: 4cqmin;
    }

    /* Landscape: clusters become absolute overlays in the slack beside the game.
       Container-relative (T1): nests in any-size GameStage, not the viewport.
       Click-through; only the control clusters capture input. */
    .input-viewer.sides {
        position: absolute;
        inset: 0;
        display: block;
        padding: 0;
        pointer-events: none;
        --pad: 9cqmin;
        --action: 11cqmin;
        --special: 9cqmin;
    }
    .input-viewer.sides .dir-viewer {
        position: absolute;
        left: 3cqmin;
        bottom: calc(4cqmin + env(safe-area-inset-bottom));
        pointer-events: auto;
    }
    .input-viewer.sides .action-key-viewer {
        position: absolute;
        right: 3cqmin;
        bottom: calc(4cqmin + env(safe-area-inset-bottom));
        pointer-events: auto;
    }
    .input-viewer.sides .special-key-viewer {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: calc(2cqmin + env(safe-area-inset-bottom));
        pointer-events: auto;
    }
    .input-viewer.sides.hide-actions .action-key-viewer {
        display: none;
    }

    :global(.input-viewer button.pressed) {
        background: var(--highlight-color, #89b4fa) !important;
        color: #1e1e2e !important;
        border-color: var(--highlight-color, #89b4fa) !important;
    }
</style>
