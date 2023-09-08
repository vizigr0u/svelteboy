import { KeyPressMap } from "./stores/playStores";
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

export function updateInput(input: InputType, pressed: boolean) {
    KeyPressMap.update(m => {
        if (!pressed)
            m.delete(input);
        else
            m.add(input);
        return m;
    })
}

export function gameInputKeydownHandler(event: KeyboardEvent) {
    if (event.defaultPrevented)
        return;

    if (!(event.key in defaultKeybinds)) {
        return;
    }

    updateInput(defaultKeybinds[event.key], true);
    event.preventDefault();
}

export function gameInputKeyupHandler(event: KeyboardEvent) {
    if (event.defaultPrevented)
        return;

    if (!(event.key in defaultKeybinds))
        return;

    updateInput(defaultKeybinds[event.key], false);
    event.preventDefault();
}

export { InputType };
