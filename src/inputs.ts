import { get } from "svelte/store";
import { EmulatorPaused, KeyPressMap } from "./stores/playStores";
import { InputType } from "./types";

export const defaultKeybinds: { [k: string]: InputType } = {
    "a": InputType.A,
    "b": InputType.B,
    "ArrowUp": InputType.Up,
    "ArrowDown": InputType.Down,
    "ArrowLeft": InputType.Left,
    "ArrowRight": InputType.Right,
    "Enter": InputType.Start,
    "Delete": InputType.Select
}

function updateInput(input: InputType, pressed: boolean) {
    KeyPressMap.update(m => {
        if (!pressed)
            m.delete(input);
        else
            m.add(input);
        return m;
    })
}

export function getInputForEmu(): number {
    let res = 0;
    for (let k of get(KeyPressMap)) {
        res |= Number(k)
    }
    return res;
}

function keydownHandler(event: KeyboardEvent) {
    if (event.defaultPrevented)
        return;

    if (get(EmulatorPaused) || !(event.key in defaultKeybinds)) {
        return;
    }

    updateInput(defaultKeybinds[event.key], true);
    event.preventDefault();
}

function keyupHandler(event: KeyboardEvent) {
    if (event.defaultPrevented)
        return;

    if (!(event.key in defaultKeybinds))
        return;

    updateInput(defaultKeybinds[event.key], false);
    event.preventDefault();
}

export function EnableKeyBoardInput() {
    window.addEventListener("keydown", keydownHandler, true);
    window.addEventListener("keyup", keyupHandler, true);
}

export function DisableKeyBoardInput() {
    window.removeEventListener("keydown", keydownHandler)
    window.removeEventListener("keyup", keyupHandler);
}

export { InputType };
