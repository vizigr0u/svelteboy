import { CartridgeType } from "../metadata";
import { Cartridge } from "../cartridge";
import { MBC } from "../memory/mbc";
import { MBC3RTC } from "../memory/mbc3rtc";
import { GB_EXT_RAM_START, GB_EXT_RAM_BANK_SIZE } from "../memory/memoryConstants";
import { describe, it, assertEquals } from "./framework";
import { setupMBCCart, writeRam, readRam, mbcWrite } from "./mbcTestHelpers";

export function testMbc3RtcRouting(): boolean {
    describe("MBC3 RTC routing", () => {

        describe("Cartridge.HasRTC flag", () => {
            it("MBC3_TIMER_BATTERY sets HasRTC", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_BATTERY, 3, 0);
                assertEquals<bool>(Cartridge.Data.HasRTC, true, "HasRTC true");
            });

            it("MBC3_TIMER_RAM_BATTERY_2 sets HasRTC", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                assertEquals<bool>(Cartridge.Data.HasRTC, true, "HasRTC true");
            });

            it("MBC3 (no timer) does not set HasRTC", () => {
                setupMBCCart(CartridgeType.MBC3, 3, 3);
                assertEquals<bool>(Cartridge.Data.HasRTC, false, "HasRTC false");
            });

            it("MBC1 does not set HasRTC", () => {
                setupMBCCart(CartridgeType.MBC1_RAM, 3, 3);
                assertEquals<bool>(Cartridge.Data.HasRTC, false, "HasRTC false");
            });
        });

        describe("RTC register select via $4000-$5FFF", () => {
            it("select $08 routes RAM-region reads to RTC seconds", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                mbcWrite(0x0000, 0x0A); // enable RAM/Timer
                MBC3RTC.SetRealTimeSec(45);
                mbcWrite(0x6000, 0x00); // latch sequence start
                mbcWrite(0x6000, 0x01); // latch now → S=45
                mbcWrite(0x4000, 0x08); // select RTC seconds
                assertEquals<u8>(readRam(), 45, "read $A000 returns latched seconds");
            });

            it("select $0B returns latched DL", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                mbcWrite(0x0000, 0x0A);
                MBC3RTC.SetRealTimeSec(86400 * 3 + 10);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01);
                mbcWrite(0x4000, 0x0B);
                assertEquals<u8>(readRam(), 3, "DL=3 days");
            });

            it("select $0C returns latched DH", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                mbcWrite(0x0000, 0x0A);
                MBC3RTC.SetRealTimeSec(86400 * 257);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01);
                mbcWrite(0x4000, 0x0C);
                assertEquals<u8>(readRam() & 1, 1, "DH bit0 set (day 257)");
            });

            it("write to $A000 with RTC selected routes to RTC WriteReg", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x4000, 0x08); // select seconds
                writeRam(42);
                assertEquals<u8>(MBC3RTC.Live(0), 42, "live S=42 after RAM write");
            });

            it("select RAM bank 0-3 clears RTC select", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                mbcWrite(0x0000, 0x0A);
                mbcWrite(0x4000, 0x02); // RAM bank 2
                writeRam(0x55);
                mbcWrite(0x4000, 0x08); // RTC seconds
                mbcWrite(0x4000, 0x02); // back to RAM bank 2
                assertEquals<u8>(readRam(), 0x55, "RAM bank 2 byte preserved");
            });
        });

        describe("latch sequence via $6000-$7FFF", () => {
            it("writing $00 then $01 latches", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_BATTERY, 3, 0);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                MBC3RTC.SetRealTimeSec(123);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01);
                assertEquals<u8>(MBC3RTC.Latched(0), 3, "latched S = 123 % 60");
                assertEquals<u8>(MBC3RTC.Latched(1), 2, "latched M = 123 / 60");
            });

            it("writing $01 alone without preceding $00 does not latch", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_BATTERY, 3, 0);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                MBC3RTC.SetRealTimeSec(30);
                mbcWrite(0x6000, 0x01); // no preceding 0
                assertEquals<u8>(MBC3RTC.Latched(0), 0, "latched S untouched");
            });

            it("two consecutive $01 writes latch once", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_BATTERY, 3, 0);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                MBC3RTC.SetRealTimeSec(10);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01); // latches S=10
                MBC3RTC.SetRealTimeSec(70);
                mbcWrite(0x6000, 0x01); // no preceding 0, no latch
                assertEquals<u8>(MBC3RTC.Latched(0), 10, "latched stays at 10");
            });

            it("$00 then $01 then $00 then $01 latches twice", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_BATTERY, 3, 0);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                MBC3RTC.SetRealTimeSec(5);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01);
                assertEquals<u8>(MBC3RTC.Latched(0), 5, "first latch S=5");
                MBC3RTC.SetRealTimeSec(15);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01);
                assertEquals<u8>(MBC3RTC.Latched(0), 15, "second latch S=15");
            });
        });

        describe("RAM passthrough when no RTC select", () => {
            it("default state: $A000 reads ext RAM", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                mbcWrite(0x0000, 0x0A);
                writeRam(0x77);
                assertEquals<u8>(readRam(), 0x77, "RAM read works");
            });
        });
    });

    return true;
}
