import { IntType, Interrupt } from "../cpu/interrupts";
import { Logger } from "../debug/logger";
import { uToHex } from "../utils/stringUtils";

const JOYPAD_ADDRESS: u16 = 0xFF00;

function log(s: string): void {
    Logger.Log("IO: " + s);
}

enum InputType {
    Right = 1 << 0,
    Left = 1 << 1,
    Up = 1 << 2,
    Down = 1 << 3,
    A = 1 << 4,
    B = 1 << 5,
    Select = 1 << 6,
    Start = 1 << 7,
}

enum InputSelector {
    None = 0,
    DirPad = 1 << 4,
    Actions = 1 << 5
}

@final
export class Joypad {
    static allowOppositeKeys: boolean = true; // TODO: config?

    private static readonly DefaultSelector: InputSelector = InputSelector.DirPad;

    private static keys: u8 = 0x00; // warning: opposite logic of gameboy for storage: 1 = pressed
    private static selector: InputSelector = Joypad.DefaultSelector;

    static Init(): void {
        Joypad.keys = 0x00;
        Joypad.selector = Joypad.DefaultSelector;
    }

    static Handles(gbAddress: u16): boolean {
        return (gbAddress == JOYPAD_ADDRESS);
    }

    static SetKeys(keys: u8): void {
        if (!Joypad.allowOppositeKeys) {
            if (Joypad.hasKey(InputType.Up))
                keys = keys & ~<u8>InputType.Down;
            if (Joypad.hasKey(InputType.Left))
                keys = keys & ~<u8>InputType.Right;
        }
        if ((Joypad.keys & keys) != keys) { // one of the bits just got set
            Interrupt.Request(IntType.Joypad);
        }
        if (Logger.verbose >= 3)
            log('Joypad keys set to ' + uToHex(keys))
        Joypad.keys = keys;
    }

    static Load(): u8 {
        if (Joypad.selector == InputSelector.None) {
            if (Logger.verbose >= 2)
                log('Joypad read with no selector: 0xFF')
            return 0xFF;
        }
        const buttonBits: u8 = (Joypad.selector == InputSelector.Actions) ? (<u8>(~Joypad.keys) >> 4) : (<u8>(~Joypad.keys) & 0xF);
        // const value: u8 = <u8>Joypad.selector | ((Joypad.keys >> ((<u8>Joypad.selector >> 5) << 2)) & 0xF);
        const value: u8 = <u8>0b11000000 | <u8>(<u8>~<u8>Joypad.selector & <u8>0b00110000) | buttonBits;
        if (Logger.verbose >= 3 || Logger.verbose >= 2 && (value & 0xF) != 0xF) // TODO: tone down
            log('Joypad read: ' + `selector: ${Joypad.selector == InputSelector.Actions ? 'Actions' : 'DirPad'}, key: ${value.toString(2)}`);
        return value;
    }

    static Store(value: u8): void {
        if (Logger.verbose >= 3)
            log(`Joypad write: ${uToHex(value)} at [${uToHex<u16>(JOYPAD_ADDRESS)}]`);
        if (Logger.verbose >= 2 && (value & 0x0F) != 0) {
            log('Unexpected write to readonly joypad bits: ' + uToHex<u8>(value));
        }
        Joypad.selector = (~value) & 0b00110000;
        if (Logger.verbose >= 3)
            log('Joypad selector set to ' + (Joypad.selector == InputSelector.Actions ? 'Actions' : (Joypad.selector == InputSelector.DirPad ? 'Dir' : 'None')));
        if (<u8>Joypad.selector == 0)
            Joypad.selector = Joypad.DefaultSelector;
    }

    @inline private static hasKey(k: InputType): boolean { return (Joypad.keys & <u8>k) != 0; }
}

export function setJoypad(keys: u8): void {
    Joypad.SetKeys(keys);
}
