import { writable } from "svelte/store";
import { InputType } from "../types";

export const GamePlaying = writable<boolean>(false);
export const GameFrames = writable<number>(0);
export const KeyPressMap = writable<Set<InputType>>(new Set<InputType>())

function isMutuallyExclusiveKeyPressed(input: InputType, keyStore: boolean[]): boolean {
    switch (input) {
        case InputType.Left:
            return keyStore[InputType.Right];
        case InputType.Right:
            return keyStore[InputType.Left]
        case InputType.Up:
            return keyStore[InputType.Down]
        case InputType.Down:
            return keyStore[InputType.Up]
    }
}