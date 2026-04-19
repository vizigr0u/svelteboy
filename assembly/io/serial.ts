import { MemoryMap } from "../memory/memoryMap";
import { Logger } from "../debug/logger";
import { IO } from "./io";
import { IntType, Interrupt } from "../cpu/interrupts";

const SB_ADDRESS: u16 = 0xFF01;
const SC_ADDRESS: u16 = 0xFF02;

function log(s: string): void {
    Logger.Log("SRL: " + s);
}

@final
export class Serial {
    static message: string = "";
    static logToConsole: boolean = false;

    static Init(): void {
        Serial.message = "";
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return (gbAddress == SB_ADDRESS || gbAddress == SC_ADDRESS);
    }

    static Store(gbAddress: u16, value: u8): void {
        if (gbAddress == SC_ADDRESS && value == 0x81) {
            const char = MemoryMap.GBload<u8>(SB_ADDRESS);
            Serial.message += String.fromCharCode(char);
            if (Serial.logToConsole)
                console.log("SERIAL: " + Serial.message);
            if (Logger.verbose >= 2) {
                log(Serial.message)
            }
            // Transfer complete: SB = $FF (no device = all 1s incoming), SC bit 7 cleared, serial interrupt
            IO.MemStore<u8>(SB_ADDRESS, 0xFF);
            Interrupt.Request(IntType.Serial);
            value = 0; // SC bit 7 cleared
        }
        IO.MemStore<u8>(gbAddress, value);
    }

    @inline
    static Load(gbAddress: u16): u8 {
        return IO.MemLoad<u8>(gbAddress);
    }
}

export function serialEnableLog(enabled: boolean = true): void {
    Serial.logToConsole = enabled;
}
