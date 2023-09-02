import { GB_OAM_SIZE, GB_OAM_START } from "../../memory/memoryConstants";
import { Logger } from "../../debug/logger";
import { InlinedArray, InlinedReadonlyView } from "../../utils/inlinedArray";
import { uToHex } from "../../utils/stringUtils";
import { Dma } from "./dma";
import { Lcd, LcdControlBit } from "./lcd";
import { Ppu, PpuMode } from "./ppu";

export const MAX_OAM_COUNT: u32 = 40;

export enum OamAttribute {
    /* 0-2: CGB pal number */
    /* CGB only TileBank = 3, */
    PaletteNumber = 4,
    XFlip = 5,
    YFlip = 6,
    BGandWindowOver = 7
}

function log(s: string): void {
    Logger.Log("MEM: " + s);
}

@unmanaged
export class OamData {
    yPos: u8;
    xPos: u8;
    tileIndex: u8;
    flags: u8;

    hasAttr(f: OamAttribute): boolean { return (this.flags & (1 << <u8>f)) != 0; }

    setAttr(f: OamAttribute, enabled: bool = 1): void {
        if (enabled)
            this.flags = this.flags | (1 << f);
        else
            this.flags = this.flags & ~(1 << f);
    }
}

@final
export class Oam {
    @inline
    static Handles(gbAddress: u16): boolean {
        return gbAddress >= 0xFE00 && gbAddress <= 0xFE9F;
    }

    static view: InlinedReadonlyView<OamData> = new InlinedReadonlyView<OamData>(GB_OAM_START, 40);

    @inline
    static Load<T>(gbAddress: u16): T {
        return Dma.active ? <T>0xff : load<T>(GB_OAM_START + gbAddress - 0xFE00);
    }

    @inline
    static Store<T>(gbAddress: u16, value: T): void {
        if (Dma.active) {
            if (Logger.verbose >= 2) {
                log('Ignoring writing to OAM during DMA: ' + uToHex<u16>(gbAddress))
            }
            return;
        }
        if (Lcd.data.hasControlBit(LcdControlBit.LCDandPPUenabled) && Ppu.currentMode != PpuMode.HBlank && Ppu.currentMode != PpuMode.VBlank) {
            if (Logger.verbose >= 2) {
                log('Ignoring writing to OAM outside of VBlank and HBlank: ' + uToHex<u16>(gbAddress) + ` (current mode: ${Ppu.currentMode})`)
            }
            return;
        }
        if (Logger.verbose >= 3)
            log('OAM write ' + uToHex<T>(value) + ' to ' + uToHex<u16>(gbAddress));

        store<T>(GB_OAM_START + gbAddress - 0xFE00, value);
    }
}