import { GB_OAM_START, MemoryMap } from "../memoryMap";
import { Dma } from "./dma";

@final
export class Oam {
    @inline
    static Handles(gbAddress: u16): boolean {
        return gbAddress >= 0xFE00 && gbAddress <= 0xFE9F;
    }

    @inline
    static Load<T>(gbAddress: u16): T {
        return Dma.active ? <T>0xff : load<T>(GB_OAM_START + gbAddress - 0xFE00);
    }

    @inline
    static Store<T>(gbAddress: u16, value: T): void {
        if (!Dma.active)
            store<T>(GB_OAM_START + gbAddress - 0xFE00, value);
    }
}