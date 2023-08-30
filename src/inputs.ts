import { KeyPressMap } from "./stores/playStores";

export enum InputType {
    Left = 0,
    Right = 1,
    Up = 2,
    Down = 3,
    A = 4,
    B = 5,
    Select = 6,
    Start = 7
}

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
    // KeyPresses.update(keys => {
    //     keys[input] = pressed;
    //     return keys;
    // })
    KeyPressMap.update(m => {
        if (!pressed)
            m.delete(input);
        else
            m.add(input);
        return m;
    })
}

function keydownHandler(event: KeyboardEvent) {
    if (event.defaultPrevented)
        return;

    if (!(event.key in defaultKeybinds)) {
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
