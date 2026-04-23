import { MemoryMap } from "../memory/memoryMap";
import { AudioRender } from "../audio/render";
import { AudioRegisters } from "../audio/audioRegisters";
import { AudioEventQueue } from "../audio/eventQueue";
import { describe, it, assertEquals } from "./framework";
import { setTestRom } from "./cpuTests";

function flushAudioEvents(): void {
    while (!AudioEventQueue.IsEmpty()) {
        AudioRender.ApplyEvent(AudioEventQueue.Dequeue());
    }
}

function initAudio(): void {
    setTestRom([0x00]);
    AudioRender.Prepare(0);
}

function testNR52MasterEnableDisable(): void {
    describe("NR52 master enable/disable", () => {
        it("writing 0x80 enables audio", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            flushAudioEvents();
            assert(AudioRender.AudioOn, "AudioOn should be true after writing 0x80 to NR52");
        });

        it("writing 0x00 disables audio", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            flushAudioEvents();
            MemoryMap.GBstore<u8>(0xFF26, 0x00);
            flushAudioEvents();
            assert(!AudioRender.AudioOn, "AudioOn should be false after writing 0x00 to NR52");
        });

        it("writing 0x00 zeros NR10-NR51 (Pan Docs: sound registers cleared on master disable)", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF10, 0x40); // NR10 sweep
            MemoryMap.GBstore<u8>(0xFF11, 0xFF); // NR11 length/duty
            MemoryMap.GBstore<u8>(0xFF12, 0xF0); // NR12 envelope
            MemoryMap.GBstore<u8>(0xFF24, 0x77); // NR50 master volume
            MemoryMap.GBstore<u8>(0xFF25, 0xFF); // NR51 panning
            flushAudioEvents();
            MemoryMap.GBstore<u8>(0xFF26, 0x00);
            flushAudioEvents();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF11), 0, "NR11");
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF12), 0, "NR12");
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF24), 0, "NR50");
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0, "NR51");
        });
    });
}

function testNR52ChannelEnableReadback(): void {
    describe("NR52 channel enable read-back", () => {
        it("bits 0-3 start clear with no active channels", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            flushAudioEvents();
            const nr52 = MemoryMap.GBload<u8>(0xFF26);
            assertEquals<u8>(nr52 & 0x0F, 0, "NR52 bits 0-3 should be 0 when no channels are active");
        });

        it("bit 2 reflects CH3 DAC-active state", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80); // enable APU
            MemoryMap.GBstore<u8>(0xFF1A, 0x80); // NR30: CH3 DAC on (bit 7)
            MemoryMap.GBstore<u8>(0xFF1E, 0x80); // NR34: trigger CH3
            flushAudioEvents();
            const nr52on = MemoryMap.GBload<u8>(0xFF26);
            assert((nr52on & 0x04) != 0, `NR52 bit 2 should be set (CH3 active), got 0x${nr52on.toString(16)}`);

            MemoryMap.GBstore<u8>(0xFF1A, 0x00); // NR30: CH3 DAC off
            flushAudioEvents();
            const nr52off = MemoryMap.GBload<u8>(0xFF26);
            assert((nr52off & 0x04) == 0, `NR52 bit 2 should be clear (CH3 DAC off), got 0x${nr52off.toString(16)}`);
        });

        it("bit 0 reflects CH1 DAC-active state", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);  // enable APU
            MemoryMap.GBstore<u8>(0xFF12, 0xF3);  // NR12: CH1 DAC on (initial vol > 0)
            MemoryMap.GBstore<u8>(0xFF14, 0x80);  // NR14: trigger CH1
            flushAudioEvents();
            const nr52 = MemoryMap.GBload<u8>(0xFF26);
            assert((nr52 & 0x01) != 0, `NR52 bit 0 should be set (CH1 active), got 0x${nr52.toString(16)}`);
        });
    });
}

function testNR50VolumeExtraction(): void {
    describe("NR50 volume extraction", () => {
        it("0x77 → LeftVolume=1.0, RightVolume=1.0", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF24, 0x77);
            flushAudioEvents();
            assert(AudioRender.LeftVolume == <f32>1.0, `LeftVolume: expected 1.0, got ${AudioRender.LeftVolume}`);
            assert(AudioRender.RightVolume == <f32>1.0, `RightVolume: expected 1.0, got ${AudioRender.RightVolume}`);
        });

        it("0x00 → LeftVolume=0.125, RightVolume=0.125", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF24, 0x00);
            flushAudioEvents();
            assert(AudioRender.LeftVolume == <f32>0.125, `LeftVolume: expected 0.125, got ${AudioRender.LeftVolume}`);
            assert(AudioRender.RightVolume == <f32>0.125, `RightVolume: expected 0.125, got ${AudioRender.RightVolume}`);
        });

        it("0x31 → LeftVolume=0.5 (left=3), RightVolume=0.25 (right=1)", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF24, 0x31);
            flushAudioEvents();
            assert(AudioRender.LeftVolume == <f32>0.5, `LeftVolume: expected 0.5, got ${AudioRender.LeftVolume}`);
            assert(AudioRender.RightVolume == <f32>0.25, `RightVolume: expected 0.25, got ${AudioRender.RightVolume}`);
        });

        it("each nibble step v maps to volume (v+1)/8", () => {
            initAudio();
            for (let v: i32 = 0; v <= 7; v++) {
                MemoryMap.GBstore<u8>(0xFF24, <u8>((v << 4) | v));
                flushAudioEvents();
                const expected: f32 = <f32>(v + 1) / <f32>8.0;
                assert(AudioRender.LeftVolume == expected, `LeftVolume step ${v}: expected ${expected}, got ${AudioRender.LeftVolume}`);
                assert(AudioRender.RightVolume == expected, `RightVolume step ${v}: expected ${expected}, got ${AudioRender.RightVolume}`);
            }
        });
    });
}

function testNR51Panning(): void {
    describe("NR51 panning", () => {
        it("0xFF routes all channels to both sides", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0xFF);
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0xFF, "NR51=0xFF");
        });

        it("0x00 disables all routing", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x00);
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0x00, "NR51=0x00");
        });

        it("CH1 routed to L (bit 4) independently of R (bit 0)", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF25, 0x10); // CH1 L only
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0x10, "NR51=0x10 (CH1 L only)");

            MemoryMap.GBstore<u8>(0xFF25, 0x01); // CH1 R only
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0x01, "NR51=0x01 (CH1 R only)");

            MemoryMap.GBstore<u8>(0xFF25, 0x11); // CH1 both
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0x11, "NR51=0x11 (CH1 L+R)");
        });

        it("bit layout: CH4-1 left in bits 7-4, CH4-1 right in bits 3-0", () => {
            initAudio();
            // CH4L=bit7, CH3L=bit6, CH2L=bit5, CH1L=bit4 / CH4R=bit3, CH3R=bit2, CH2R=bit1, CH1R=bit0
            MemoryMap.GBstore<u8>(0xFF25, 0x84); // CH4 left + CH3 right
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0x84, "NR51=0x84");

            MemoryMap.GBstore<u8>(0xFF25, 0x42); // CH3 left + CH2 right
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0x42, "NR51=0x42");

            MemoryMap.GBstore<u8>(0xFF25, 0xF0); // all left, no right
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF25), 0xF0, "NR51=0xF0");
        });
    });
}

function testRegisterBitFieldMasking(): void {
    describe("register bit-field masking via getChange", () => {
        it("NR10 (0x10): bit 7 always 1, bits 0-6 from value", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x10, 0x00), 0x80, "NR10 0x00→0x80");
            assertEquals<u8>(AudioRegisters.getChange(0x10, 0xFF), 0xFF, "NR10 0xFF→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x10, 0x7F), 0xFF, "NR10 0x7F→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x10, 0x55), 0xD5, "NR10 0x55→0xD5");
        });

        it("NR14/NR24/NR34 (0x14,0x19,0x1E): bits 3-5 always 1", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x14, 0x00), 0x38, "NR14 0x00→0x38");
            assertEquals<u8>(AudioRegisters.getChange(0x14, 0xFF), 0xFF, "NR14 0xFF→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x14, 0x80), 0xB8, "NR14 0x80→0xB8");
            assertEquals<u8>(AudioRegisters.getChange(0x14, 0xC7), 0xFF, "NR14 0xC7→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x19, 0x00), 0x38, "NR24 0x00→0x38");
            assertEquals<u8>(AudioRegisters.getChange(0x1E, 0x00), 0x38, "NR34 0x00→0x38");
        });

        it("NR30 (0x1A): bits 0-6 always 1, only bit 7 writable", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x1A, 0x00), 0x7F, "NR30 0x00→0x7F");
            assertEquals<u8>(AudioRegisters.getChange(0x1A, 0xFF), 0xFF, "NR30 0xFF→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x1A, 0x80), 0xFF, "NR30 0x80→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x1A, 0x00), 0x7F, "NR30 0x00→0x7F");
        });

        it("NR32 (0x1C): bit 7 and bits 0-4 always 1, bits 5-6 writable", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x1C, 0x00), 0x9F, "NR32 0x00→0x9F");
            assertEquals<u8>(AudioRegisters.getChange(0x1C, 0xFF), 0xFF, "NR32 0xFF→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x1C, 0x20), 0xBF, "NR32 0x20→0xBF");
            assertEquals<u8>(AudioRegisters.getChange(0x1C, 0x40), 0xDF, "NR32 0x40→0xDF");
            assertEquals<u8>(AudioRegisters.getChange(0x1C, 0x60), 0xFF, "NR32 0x60→0xFF");
        });

        it("NR41 (0x20): bits 6-7 always 1, bits 0-5 writable (length)", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x20, 0x00), 0xC0, "NR41 0x00→0xC0");
            assertEquals<u8>(AudioRegisters.getChange(0x20, 0xFF), 0xFF, "NR41 0xFF→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x20, 0x3F), 0xFF, "NR41 0x3F→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x20, 0x0F), 0xCF, "NR41 0x0F→0xCF");
        });

        it("NR44 (0x23): bits 0-5 always 1, only bits 6-7 writable", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x23, 0x00), 0x3F, "NR44 0x00→0x3F");
            assertEquals<u8>(AudioRegisters.getChange(0x23, 0xFF), 0xFF, "NR44 0xFF→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x23, 0xC0), 0xFF, "NR44 0xC0→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x23, 0x80), 0xBF, "NR44 0x80→0xBF");
            assertEquals<u8>(AudioRegisters.getChange(0x23, 0x40), 0x7F, "NR44 0x40→0x7F");
        });

        it("NR52 (0x26): bits 4-6 always 1, bits 7 and 0-3 writable", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x26, 0x00), 0x70, "NR52 0x00→0x70");
            assertEquals<u8>(AudioRegisters.getChange(0x26, 0xFF), 0xFF, "NR52 0xFF→0xFF");
            assertEquals<u8>(AudioRegisters.getChange(0x26, 0x80), 0xF0, "NR52 0x80→0xF0");
            assertEquals<u8>(AudioRegisters.getChange(0x26, 0x0F), 0x7F, "NR52 0x0F→0x7F");
            assertEquals<u8>(AudioRegisters.getChange(0x26, 0x8F), 0xFF, "NR52 0x8F→0xFF");
        });

        it("pass-through registers return value unchanged", () => {
            // NR11,NR12,NR13 (CH1); NR21,NR22,NR23 (CH2); NR31,NR33 (CH3); NR42,NR43 (CH4); NR50,NR51
            const regs = <Array<u8>>[0x11, 0x12, 0x13, 0x16, 0x17, 0x18, 0x1B, 0x1D, 0x21, 0x22, 0x24, 0x25];
            for (let i = 0; i < regs.length; i++) {
                const r = regs[i];
                assertEquals<u8>(AudioRegisters.getChange(r, 0x00), 0x00, `reg 0x${r.toString(16)} 0x00`);
                assertEquals<u8>(AudioRegisters.getChange(r, 0xFF), 0xFF, `reg 0x${r.toString(16)} 0xFF`);
                assertEquals<u8>(AudioRegisters.getChange(r, 0xAB), 0xAB, `reg 0x${r.toString(16)} 0xAB`);
            }
        });

        it("wave registers (0x30-0x3F) are pass-through", () => {
            assertEquals<u8>(AudioRegisters.getChange(0x30, 0xAB), 0xAB, "wave 0x30");
            assertEquals<u8>(AudioRegisters.getChange(0x35, 0x42), 0x42, "wave 0x35");
            assertEquals<u8>(AudioRegisters.getChange(0x3F, 0xCD), 0xCD, "wave 0x3F");
        });
    });
}

function testReservedRegistersRead(): void {
    describe("write-only/reserved registers read 0xFF", () => {
        it("0xFF15 (unused between CH1 and CH2) reads 0xFF", () => {
            initAudio();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF15), 0xFF, "0xFF15");
        });

        it("0xFF1F (unused between CH3 and CH4) reads 0xFF", () => {
            initAudio();
            assertEquals<u8>(MemoryMap.GBload<u8>(0xFF1F), 0xFF, "0xFF1F");
        });

        it("0xFF27-0xFF2F (between NR52 and wave RAM) all read 0xFF", () => {
            initAudio();
            for (let addr: u16 = 0xFF27; addr <= 0xFF2F; addr++) {
                assertEquals<u8>(MemoryMap.GBload<u8>(addr), 0xFF, `addr 0x${addr.toString(16)}`);
            }
        });
    });
}

function testNR52CH2CH4ChannelStatus(): void {
    describe("NR52 channel active status: CH2 bit1 and CH4 bit3", () => {
        it("bit 1 set when CH2 active after trigger (NR22 DAC on)", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            MemoryMap.GBstore<u8>(0xFF17, 0xF3); // NR22: vol=15, DAC on
            MemoryMap.GBstore<u8>(0xFF19, 0x80); // NR24: trigger CH2
            flushAudioEvents();
            const nr52 = MemoryMap.GBload<u8>(0xFF26);
            assert((nr52 & 0x02) != 0, `NR52 bit 1 should be set (CH2 active), got 0x${nr52.toString(16)}`);
        });

        it("bit 1 clears when CH2 DAC disabled via NR22 & $F8 = 0", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            MemoryMap.GBstore<u8>(0xFF17, 0xF3);
            MemoryMap.GBstore<u8>(0xFF19, 0x80);
            flushAudioEvents();
            MemoryMap.GBstore<u8>(0xFF17, 0x00); // NR22 bits 3-7 all 0 → DAC off
            flushAudioEvents();
            const nr52 = MemoryMap.GBload<u8>(0xFF26);
            assert((nr52 & 0x02) == 0, `NR52 bit 1 should be clear (CH2 DAC off), got 0x${nr52.toString(16)}`);
        });

        it("bit 3 set when CH4 active after trigger (NR42 DAC on)", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            MemoryMap.GBstore<u8>(0xFF21, 0xF3); // NR42: vol=15, DAC on
            MemoryMap.GBstore<u8>(0xFF22, 0x11); // NR43: shift=1, divider=1
            MemoryMap.GBstore<u8>(0xFF23, 0x80); // NR44: trigger CH4
            flushAudioEvents();
            const nr52 = MemoryMap.GBload<u8>(0xFF26);
            assert((nr52 & 0x08) != 0, `NR52 bit 3 should be set (CH4 active), got 0x${nr52.toString(16)}`);
        });

        it("bit 3 clears when CH4 DAC disabled via NR42 & $F8 = 0", () => {
            initAudio();
            MemoryMap.GBstore<u8>(0xFF26, 0x80);
            MemoryMap.GBstore<u8>(0xFF21, 0xF3);
            MemoryMap.GBstore<u8>(0xFF22, 0x11);
            MemoryMap.GBstore<u8>(0xFF23, 0x80);
            flushAudioEvents();
            MemoryMap.GBstore<u8>(0xFF21, 0x00); // NR42 & $F8 = 0 → DAC off
            flushAudioEvents();
            const nr52 = MemoryMap.GBload<u8>(0xFF26);
            assert((nr52 & 0x08) == 0, `NR52 bit 3 should be clear (CH4 DAC off), got 0x${nr52.toString(16)}`);
        });
    });
}

function testWaveRamUnaffectedByAPUOff(): void {
    // Pan Docs: APU off (NR52 bit7=0) clears NR10-NR51 only. Wave RAM ($FF30-$FF3F) is unaffected.
    describe("wave RAM unaffected by APU power-off", () => {
        it("wave RAM bytes survive NR52=0x00 power-off", () => {
            initAudio();
            for (let i = 0; i < 16; i++) {
                MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), <u8>(0xA0 + i));
            }
            MemoryMap.GBstore<u8>(0xFF26, 0x00); // APU off
            flushAudioEvents();
            for (let i = 0; i < 16; i++) {
                assertEquals<u8>(MemoryMap.GBload<u8>(<u16>(0xFF30 + i)), <u8>(0xA0 + i),
                    `Wave RAM byte ${i} should survive APU off`);
            }
        });

        it("wave RAM unchanged through full off/on cycle", () => {
            initAudio();
            for (let i = 0; i < 16; i++) {
                MemoryMap.GBstore<u8>(<u16>(0xFF30 + i), <u8>(0x10 + i));
            }
            MemoryMap.GBstore<u8>(0xFF26, 0x00); // APU off
            flushAudioEvents();
            MemoryMap.GBstore<u8>(0xFF26, 0x80); // APU on
            flushAudioEvents();
            for (let i = 0; i < 16; i++) {
                assertEquals<u8>(MemoryMap.GBload<u8>(<u16>(0xFF30 + i)), <u8>(0x10 + i),
                    `Wave RAM byte ${i} should survive off/on cycle`);
            }
        });
    });
}

export function testAudioRegisters(): boolean {
    testNR52MasterEnableDisable();
    testNR52ChannelEnableReadback();
    testNR52CH2CH4ChannelStatus();
    testNR50VolumeExtraction();
    testNR51Panning();
    testRegisterBitFieldMasking();
    testReservedRegistersRead();
    testWaveRamUnaffectedByAPUOff();
    return true;
}
