import { GB_OAM_START, GB_VIDEO_START, GB_VIDEO_BANK_SIZE } from "../../memory/memoryConstants";
import { MemoryMap } from "../../memory/memoryMap";
import { Logger } from "../../debug/logger";
import { uToHex } from "../../utils/stringUtils";
import { CgbState } from "../../cgbState";

// HDMA registers (CGB only): FF51-FF55
const HDMA1_ADDRESS: u16 = 0xFF51; // source high byte
const HDMA2_ADDRESS: u16 = 0xFF52; // source low byte  (bits 3-0 ignored, always 0)
const HDMA3_ADDRESS: u16 = 0xFF53; // dest high byte   (only bits 4-0 used)
const HDMA4_ADDRESS: u16 = 0xFF54; // dest low byte    (bits 3-0 ignored, always 0)
const HDMA5_ADDRESS: u16 = 0xFF55; // length/mode/start

function log(s: string): void {
    Logger.Log("DMA: " + s);
}

@final
export class Dma {
    // OAM DMA state
    static active: boolean = false;
    static offset: u8 = 0;
    static value: u8 = 0;
    static startDelay: u8 = 0;

    // HDMA state (CGB only)
    static hdma1: u8 = 0xFF;
    static hdma2: u8 = 0xFF;
    static hdma3: u8 = 0xFF;
    static hdma4: u8 = 0xFF;
    static hdmaSrc: u16 = 0;
    static hdmaDst: u16 = 0x8000;
    static hdmaBlocksRemaining: u8 = 0;
    static hdmaHBlankMode: boolean = false;
    static hdmaActive: boolean = false;

    static Init(): void {
        Dma.active = false;
        Dma.offset = 0;
        Dma.value = 0;
        Dma.startDelay = 0;
        Dma.hdma1 = 0xFF;
        Dma.hdma2 = 0xFF;
        Dma.hdma3 = 0xFF;
        Dma.hdma4 = 0xFF;
        Dma.hdmaSrc = 0;
        Dma.hdmaDst = 0x8000;
        Dma.hdmaBlocksRemaining = 0;
        Dma.hdmaHBlankMode = false;
        Dma.hdmaActive = false;
    }

    static Start(value: u8): void {
        if (Logger.verbose >= 2)
            log(`OAM DMA transfer started`);
        Dma.active = true;
        Dma.offset = 0;
        Dma.value = value;
        Dma.startDelay = 2;
    }

    static Tick(): void {
        if (Dma.startDelay > 0) {
            Dma.startDelay--;
            return;
        }

        const srcAddress: u16 = <u16>(Dma.value * 0x100 + Dma.offset);
        const value = load<u8>(MemoryMap.GBToMemory(srcAddress));
        if (Logger.verbose >= 3)
            log(`OAM DMA: ${uToHex<u8>(value)} ${uToHex<u16>(srcAddress)}->${uToHex(0xFE00 + Dma.offset)}`);
        unchecked(store<u8>(GB_OAM_START + Dma.offset, value));

        Dma.offset++;
        Dma.active = Dma.offset <= 0x9F;

        if (!Dma.active && Logger.verbose >= 2) {
            log("OAM DMA transfer done.");
        }
    }

    @inline
    static Handles(gbAddress: u16): boolean {
        return CgbState.isCgbMode && gbAddress >= HDMA1_ADDRESS && gbAddress <= HDMA5_ADDRESS;
    }

    static Store(gbAddress: u16, value: u8): void {
        switch (gbAddress) {
            case HDMA1_ADDRESS:
                Dma.hdma1 = value;
                break;
            case HDMA2_ADDRESS:
                Dma.hdma2 = value & 0xF0;
                break;
            case HDMA3_ADDRESS:
                Dma.hdma3 = value & 0x1F;
                break;
            case HDMA4_ADDRESS:
                Dma.hdma4 = value & 0xF0;
                break;
            case HDMA5_ADDRESS:
                Dma.hdmaStartTransfer(value);
                break;
        }
    }

    static Load(gbAddress: u16): u8 {
        if (gbAddress == HDMA5_ADDRESS) {
            if (!Dma.hdmaActive)
                return 0xFF;
            // bit 7 = 0 (active), bits 6-0 = remaining blocks - 1
            return <u8>(Dma.hdmaBlocksRemaining - 1) & 0x7F;
        }
        return 0xFF; // HDMA1-4 are write-only
    }

    // Called from PPU on each HBlank entry (HBlank HDMA only)
    static HDMATick(): void {
        if (!Dma.hdmaActive || !Dma.hdmaHBlankMode)
            return;
        Dma.transferBlock();
    }

    private static hdmaStartTransfer(value: u8): void {
        const hBlankMode = (value & 0x80) != 0;

        if (!hBlankMode && Dma.hdmaActive) {
            // writing FF55 with bit7=0 while HBlank HDMA active cancels it
            if (Logger.verbose >= 2)
                log('HBlank HDMA cancelled');
            Dma.hdmaActive = false;
            return;
        }

        Dma.hdmaSrc = (<u16>Dma.hdma1 << 8) | Dma.hdma2;
        Dma.hdmaDst = 0x8000 | (<u16>Dma.hdma3 << 8) | Dma.hdma4;
        Dma.hdmaBlocksRemaining = (value & 0x7F) + 1;
        Dma.hdmaHBlankMode = hBlankMode;
        Dma.hdmaActive = true;

        if (Logger.verbose >= 2)
            log(`HDMA ${hBlankMode ? 'HBlank' : 'General'} start: src=${uToHex<u16>(Dma.hdmaSrc)} dst=${uToHex<u16>(Dma.hdmaDst)} blocks=${Dma.hdmaBlocksRemaining}`);

        if (!hBlankMode) {
            // GDMA: bulk transfer all blocks immediately (CPU halted during this)
            while (Dma.hdmaBlocksRemaining > 0) {
                Dma.transferBlock();
            }
        }
    }

    private static transferBlock(): void {
        for (let i: u16 = 0; i < 16; i++) {
            const val = load<u8>(MemoryMap.GBToMemory(Dma.hdmaSrc + i));
            const vramOffset = (Dma.hdmaDst + i - 0x8000) & 0x1FFF;
            const dstPhys = GB_VIDEO_START + vramOffset + CgbState.vramBank * GB_VIDEO_BANK_SIZE;
            store<u8>(dstPhys, val);
        }
        if (Logger.verbose >= 3)
            log(`HDMA block: ${uToHex<u16>(Dma.hdmaSrc)}->${uToHex<u16>(Dma.hdmaDst)}`);
        Dma.hdmaSrc += 16;
        Dma.hdmaDst = 0x8000 | ((Dma.hdmaDst - 0x8000 + 16) & 0x1FF0);
        Dma.hdmaBlocksRemaining--;
        if (Dma.hdmaBlocksRemaining == 0) {
            Dma.hdmaActive = false;
            if (Logger.verbose >= 2)
                log('HDMA transfer complete');
        }
    }
}
