import { KeyPressMap } from "stores/playStores";
import { KeyBindingsStore } from "stores/optionsStore";
import { InputType } from "./types";

let activeKeybinds: { [k: string]: InputType } = {};

KeyBindingsStore.subscribe(bindings => {
    activeKeybinds = {
        [bindings.up]:     InputType.Up,
        [bindings.down]:   InputType.Down,
        [bindings.left]:   InputType.Left,
        [bindings.right]:  InputType.Right,
        [bindings.a]:      InputType.A,
        [bindings.b]:      InputType.B,
        [bindings.select]: InputType.Select,
        "Enter":           InputType.Start,
    };
});

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

    if (!(event.key in activeKeybinds))
        return;

    updateInput(activeKeybinds[event.key], true);
    event.preventDefault();
}

export function gameInputKeyupHandler(event: KeyboardEvent) {
    if (event.defaultPrevented)
        return;

    if (!(event.key in activeKeybinds))
        return;

    updateInput(activeKeybinds[event.key], false);
    event.preventDefault();
}

export { InputType };
