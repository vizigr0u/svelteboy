import { CartridgeType } from "../metadata";
import { MBC3RTC, RTC_BLOB_SIZE } from "../memory/mbc3rtc";
import { SaveGame } from "../memory/savegame";
import { GB_EXT_RAM_BANK_SIZE } from "../memory/memoryConstants";
import { describe, it, assertEquals } from "./framework";
import { setupMBCCart, mbcWrite, snapshotSaveBuffer } from "./mbcTestHelpers";

export function testMbc3RtcSave(): boolean {
    describe("MBC3 RTC savegame", () => {

        describe("Save() size", () => {
            it("MBC3_TIMER_RAM_BATTERY_2: ramSize + 48", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                SaveGame.Init();
                SaveGame.Save();
                const expected = 4 * GB_EXT_RAM_BANK_SIZE + RTC_BLOB_SIZE;
                assertEquals<i32>(SaveGame.GetBuffer().byteLength, expected, "buffer length");
            });

            it("MBC3_TIMER_BATTERY (no RAM): 48 bytes", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_BATTERY, 3, 0);
                SaveGame.Init();
                SaveGame.Save();
                assertEquals<i32>(SaveGame.GetBuffer().byteLength, <i32>RTC_BLOB_SIZE, "buffer length = RTC only");
            });

            it("MBC3 (no RTC): no trailing 48 bytes", () => {
                setupMBCCart(CartridgeType.MBC3_RAM_BATTERY_2, 3, 3);
                SaveGame.Init();
                SaveGame.Save();
                assertEquals<i32>(SaveGame.GetBuffer().byteLength, 4 * GB_EXT_RAM_BANK_SIZE, "no RTC trailing");
            });
        });

        describe("Save() format", () => {
            it("RTC blob at end contains live + latched + epoch", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                mbcWrite(0x0000, 0x0A);
                MBC3RTC.SetRealTimeSec(125);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01); // latch S=5, M=2

                SaveGame.Save();
                const buf = SaveGame.GetBuffer();
                const off = 4 * GB_EXT_RAM_BANK_SIZE;
                assertEquals<u8>(buf[off + 0], 5, "live S byte 0");
                assertEquals<u8>(buf[off + 4], 2, "live M byte 4");
                assertEquals<u8>(buf[off + 20], 5, "latched S byte 20");
                assertEquals<u8>(buf[off + 24], 2, "latched M byte 24");
            });
        });

        describe("LoadSave() ext RAM + 48-byte RTC blob", () => {
            it("advances RTC by elapsed seconds since saved", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(1_000_000);
                MBC3RTC.Init();
                mbcWrite(0x0000, 0x0A);
                MBC3RTC.SetRealTimeSec(1_000_010);
                mbcWrite(0x6000, 0x00);
                mbcWrite(0x6000, 0x01);
                SaveGame.Save();
                const savedBlob = snapshotSaveBuffer();

                // Fresh cart, 60s later
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(1_000_070);
                MBC3RTC.Init();
                SaveGame.LoadSave(savedBlob);
                assertEquals<u8>(MBC3RTC.Live(0), 10, "S = (10 + 60) % 60 = 10");
                assertEquals<u8>(MBC3RTC.Live(1), 1, "M = 1");
            });

            it("loads ext RAM correctly with RTC trailer", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(0);
                MBC3RTC.Init();
                SaveGame.Init();
                const blob = new Uint8Array(4 * GB_EXT_RAM_BANK_SIZE + 48);
                blob[0] = 0xAB;
                blob[4 * GB_EXT_RAM_BANK_SIZE - 1] = 0xCD;
                MBC3RTC.SetRealTimeSec(0); // savedTs=0 → no advance
                SaveGame.LoadSave(blob);
                mbcWrite(0x0000, 0x0A); // enable to read
                mbcWrite(0x4000, 0x00); // bank 0
            });
        });

        describe("LoadSave() with 44-byte RTC blob (legacy VBA)", () => {
            it("accepts ramSize + 44 buffer", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(1_000_000);
                MBC3RTC.Init();
                SaveGame.Init();
                const blob = new Uint8Array(4 * GB_EXT_RAM_BANK_SIZE + 44);
                // Live S=15 at byte ramSize+0
                blob[4 * GB_EXT_RAM_BANK_SIZE + 0] = 15;
                // 32-bit timestamp at byte ramSize+40
                const tsOff = 4 * GB_EXT_RAM_BANK_SIZE + 40;
                blob[tsOff] = 0x40; blob[tsOff + 1] = 0x42; blob[tsOff + 2] = 0x0F; blob[tsOff + 3] = 0x00; // 1_000_000
                MBC3RTC.SetRealTimeSec(1_000_005);
                SaveGame.LoadSave(blob);
                assertEquals<u8>(MBC3RTC.Live(0), 20, "S = 15 + 5");
            });
        });

        describe("LoadSave() without RTC trailer on RTC cart", () => {
            it("ramSize-only buffer leaves RTC at default (no advance)", () => {
                setupMBCCart(CartridgeType.MBC3_TIMER_RAM_BATTERY_2, 3, 3);
                MBC3RTC.SetRealTimeSec(1_000_000);
                MBC3RTC.Init();
                SaveGame.Init();
                const blob = new Uint8Array(4 * GB_EXT_RAM_BANK_SIZE);
                SaveGame.LoadSave(blob);
                assertEquals<u8>(MBC3RTC.Live(0), 0, "S still 0");
            });
        });
    });

    return true;
}
