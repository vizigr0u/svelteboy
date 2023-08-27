import { GB_OAM_SIZE, GB_OAM_START } from "../../cpu/memoryConstants";
import { InlinedArray, InlinedReadonlyView } from "../../utils/inlinedArray";
import { Dma } from "./dma";
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
        if (!Dma.active && (Ppu.currentMode == PpuMode.HBlank || Ppu.currentMode == PpuMode.VBlank))
            store<T>(GB_OAM_START + gbAddress - 0xFE00, value);
    }
}