import { Interrupt } from "../cpu/interrupts";
import { Logger, log } from "../debug/logger";
import { MemoryMap } from "../cpu/memoryMap";
import { GB_IO_SIZE, GB_IO_START } from "../cpu/memoryConstants";
import { Serial } from "./serial";
import { uToHex } from "../utils/stringUtils";
import { Timer } from "./timer";
import { Dma } from "./video/dma";
import { Lcd } from "./video/lcd";
import { AudioInput } from "./audioInputs";
import { Joypad } from "./joypad";
import { Cpu } from "../cpu/cpu";
import { Emulator } from "../emulator";

const UNHANDLED_CGB_START: u32 = 0xFF4D;

@final
export class IO {
    static Init(): void {
        if (Logger.verbose >= 2) {
            log('Initializing IO');
        }
        Joypad.Init();
        Timer.Init();
        Serial.Init();
        Dma.Init();
    }

    static Handles(gbAddress: u16): boolean {
        return (gbAddress >= 0xFF00 && gbAddress <= 0xFF7F);
    }

    static Store(gbAddress: u16, value: u8): void {
        if (gbAddress == 0xFF50) {
            if (MemoryMap.useBootRom) {
                if (Logger.verbose >= 1) {
                    log('Disabling bootrom');
                }
                MemoryMap.useBootRom = false;
            } else {
                if (Logger.verbose >= 1)
                    log('Ignoring write to 0xFF50 after boot rom was disabled')
            }

        }
        if (Logger.verbose >= 4)
            log(`IO [${uToHex<u16>(gbAddress)}] <- ${uToHex<u8>(value)} ([${uToHex<u32>(MemoryMap.GBToMemory(gbAddress))}])`)
        if (Serial.Handles(gbAddress)) {
            Serial.Store(gbAddress, value);
        } else if (Lcd.Handles(gbAddress)) {
            Lcd.Store(gbAddress, value);
        } else if (Timer.Handles(gbAddress)) {
            Timer.Store(gbAddress, value);
        } else if (Joypad.Handles(gbAddress)) {
            Joypad.Store(value);
        } else if (AudioInput.Handles(gbAddress)) {
            AudioInput.Store(gbAddress, value);
        } else if (gbAddress >= UNHANDLED_CGB_START) {
            if (Logger.verbose >= 3) {
                log('Unhandled write to CGB Flag ' + uToHex<u16>(gbAddress));
            }
        } else {
            IO.MemStore<u8>(gbAddress, value);
            if (!Interrupt.Handles(gbAddress))
                if (Logger.verbose >= 1)
                    log(`Unhandled IO write: ${uToHex<u8>(value)} to [${uToHex<u16>(gbAddress)}]`);
        }
    }

    static Load(gbAddress: u16): u8 {
        if (Logger.verbose >= 4)
            log(`IO read at [${uToHex<u16>(gbAddress)}] ([${uToHex<u32>(MemoryMap.GBToMemory(gbAddress))}])`);

        if (Timer.Handles(gbAddress)) {
            return Timer.Load(gbAddress);
        }
        if (Serial.Handles(gbAddress)) {
            return Serial.Load(gbAddress);
        }
        if (Lcd.Handles(gbAddress)) {
            return Lcd.Load(gbAddress);
        }
        if (Interrupt.Handles(gbAddress)) {
            return IO.MemLoad<u8>(gbAddress);
        }
        if (Joypad.Handles(gbAddress)) {
            return Joypad.Load();
        }
        if (AudioInput.Handles(gbAddress)) {
            return IO.MemLoad<u8>(gbAddress);
        }
        if (gbAddress >= UNHANDLED_CGB_START) {
            if (Logger.verbose >= 3) {
                log('Unhandled read of CGB Flag ' + uToHex<u16>(gbAddress));
            }
            return 0xFF;
        }
        if (Logger.verbose >= 1)
            log('Unhandled IO read: ' + uToHex<u16>(gbAddress));
        return IO.MemLoad<u8>(gbAddress);
    }

    @inline
    static MemLoad<T>(gbAddress: u16): T {
        if (Logger.verbose >= 4)
            log(`IO read at [${uToHex<u16>(gbAddress)}] ([${uToHex<u32>(MemoryMap.GBToMemory(gbAddress))}])`);
        return load<T>(GB_IO_START + gbAddress - 0xFF00);
    }

    @inline
    static MemStore<T>(gbAddress: u16, value: T): void {
        if (Logger.verbose >= 4)
            log(`IO [${uToHex<u16>(gbAddress)}]<- ${uToHex<T>(value)} ([${uToHex<u32>(MemoryMap.GBToMemory(gbAddress))}])`);
        store<T>(GB_IO_START + gbAddress - 0xFF00, value);
    }
}