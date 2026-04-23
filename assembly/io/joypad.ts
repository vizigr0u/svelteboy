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

    // DMG post-boot: both groups selected (P1=$CF = bits4+5 low)
    private static readonly DefaultSelector: InputSelector = <InputSelector>(<u8>InputSelector.DirPad | <u8>InputSelector.Actions);

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
        const newlyPressed: u8 = ~Joypad.keys & keys;
        const groupMask: u8 = ((<u8>Joypad.selector & <u8>InputSelector.DirPad)  ? <u8>0x0F : <u8>0)
                            | ((<u8>Joypad.selector & <u8>InputSelector.Actions) ? <u8>0xF0 : <u8>0);
        if (newlyPressed & groupMask) {
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
        const dpadBits: u8 = <u8>(~Joypad.keys) & 0xF;
        const actionBits: u8 = <u8>(~Joypad.keys) >> 4;
        // active-low: pressing either group drives the line low → AND the two nibbles
        const buttonBits: u8 = (Joypad.selector == InputSelector.Actions)
            ? actionBits
            : (Joypad.selector == InputSelector.DirPad)
                ? dpadBits
                : dpadBits & actionBits; // both groups selected
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
    }

    @inline private static hasKey(k: InputType): boolean { return (Joypad.keys & <u8>k) != 0; }
}

export function setJoypad(keys: u8): void {
    Joypad.SetKeys(keys);
}
