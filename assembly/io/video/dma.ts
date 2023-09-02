import { GB_OAM_START } from "../../memory/memoryConstants";
import { MemoryMap } from "../../memory/memoryMap";
import { Logger } from "../../debug/logger";
import { uToHex } from "../../utils/stringUtils";

function log(s: string): void {
    Logger.Log("PPU: " + s);
}

@final
export class Dma {
    static active: boolean = false;
    static offset: u8 = 0;
    static value: u8 = 0;
    static startDelay: u8 = 0;

    static Init(): void {
        Dma.active = false;
        Dma.offset = 0;
        Dma.value = 0;
        Dma.startDelay = 0;
    }

    static Start(value: u8): void {
        if (Logger.verbose >= 2)
            log(`DMA transfer started`);
        Dma.active = true;
        Dma.offset = 0;
        Dma.value = value;
        Dma.startDelay = 2;
    }

    static Tick(): void {
        if (!Dma.active)
            return;

        if (Dma.startDelay > 0) {
            Dma.startDelay--;
            return;
        }

        const srcAddress: u16 = <u16>(Dma.value * 0x100 + Dma.offset);
        const value = load<u8>(MemoryMap.GBToMemory(srcAddress));
        if (Logger.verbose >= 3)
            log(`DMA transferring: ${uToHex<u8>(value)} ${uToHex<u16>(srcAddress)}->${uToHex(0xFE00 + Dma.offset)}`);
        store<u8>(GB_OAM_START + Dma.offset, value);

        Dma.offset++;
        Dma.active = Dma.offset <= 0x9F;

        if (!Dma.active && Logger.verbose >= 2) {
            log("DMA transfer done.");
        }
    }
}
