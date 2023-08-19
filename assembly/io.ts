import { Interrupt } from "./interrupts";
import { Logger, log } from "./logger";
import { GB_IO_START, MemoryMap } from "./memoryMap";
import { Serial } from "./serial";
import { uToHex } from "./stringUtils";
import { Timer } from "./timer";
import { Dma } from "./video/dma";
import { Lcd } from "./video/lcd";

@final
export class IO {
    static Init(): void {
        Timer.Init();
        Serial.Init();
        Dma.Init();
    }

    static Handles(gbAddress: u16): boolean {
        return (gbAddress >= 0xFF00 && gbAddress <= 0xFF7F);
    }

    static Store(gbAddress: u16, value: u8): void {
        if (Logger.verbose >= 4)
            log(`IO [${uToHex<u16>(gbAddress)}] <- ${uToHex<u8>(value)} ([${uToHex<u32>(MemoryMap.GBToMemory(gbAddress))}])`)
        if (Serial.Handles(gbAddress)) {
            Serial.Store(gbAddress, value);
        } else if (Lcd.Handles(gbAddress)) {
            Lcd.Store(gbAddress, value);
        } else if (Timer.Handles(gbAddress)) {
            Timer.Store(gbAddress, value);
        } else if (Dma.Handles(gbAddress)) {
            Dma.Start(value);
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
        if (!Interrupt.Handles(gbAddress))
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