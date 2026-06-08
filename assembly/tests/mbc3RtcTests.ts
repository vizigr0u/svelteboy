import { MBC3RTC } from "../memory/mbc3rtc";
import { describe, it, assertEquals } from "./framework";

function resetAtEpoch(epochSec: i64): void {
    MBC3RTC.SetRealTimeSec(epochSec);
    MBC3RTC.Init();
}

export function testMbc3Rtc(): boolean {
    describe("MBC3 RTC", () => {

        describe("Init", () => {
            it("clears all live regs", () => {
                resetAtEpoch(1_700_000_000);
                for (let i: i32 = 0; i < 5; i++) {
                    assertEquals<u8>(MBC3RTC.Live(i), 0, "live[" + i.toString() + "]");
                }
            });

            it("clears all latched regs", () => {
                resetAtEpoch(1_700_000_000);
                for (let i: i32 = 0; i < 5; i++) {
                    assertEquals<u8>(MBC3RTC.Latched(i), 0, "latched[" + i.toString() + "]");
                }
            });

            it("clears halt + carry flags", () => {
                resetAtEpoch(1_700_000_000);
                assertEquals<bool>(MBC3RTC.Halted, false, "halt");
                assertEquals<bool>(MBC3RTC.Carry, false, "carry");
            });

            it("fresh boot: Init then first SetRealTimeSec does NOT trigger spurious time advance", () => {
                // Cold WASM start: host has never called setRealTimeMs.
                MBC3RTC.UnprimeForTest();
                MBC3RTC.Init();
                // First preRun stamps wall-clock time:
                MBC3RTC.SetRealTimeSec(1_700_000_000);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 0, "S=0 (no spurious advance)");
                assertEquals<u8>(MBC3RTC.Live(3), 0, "DL=0");
                assertEquals<u8>(MBC3RTC.Live(4) & 1, 0, "DH bit0=0");
                assertEquals<bool>(MBC3RTC.Carry, false, "carry not set");
            });
        });

        describe("time advance", () => {
            it("65 seconds = 1m 5s", () => {
                resetAtEpoch(1000);
                MBC3RTC.SetRealTimeSec(1065);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 5, "seconds");
                assertEquals<u8>(MBC3RTC.Live(1), 1, "minutes");
                assertEquals<u8>(MBC3RTC.Live(2), 0, "hours");
            });

            it("3661s = 1h 1m 1s", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(3661);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 1, "S");
                assertEquals<u8>(MBC3RTC.Live(1), 1, "M");
                assertEquals<u8>(MBC3RTC.Live(2), 1, "H");
            });

            it("1 day = DL=1", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(86400);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(3), 1, "DL");
                assertEquals<u8>(MBC3RTC.Live(4) & 1, 0, "day bit 9");
                assertEquals<u8>(MBC3RTC.Live(0), 0, "S");
            });

            it("256 days = DL=0, DH bit0=1", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(86400 * 256);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(3), 0, "DL=0");
                assertEquals<u8>(MBC3RTC.Live(4) & 1, 1, "day bit 9 set");
            });

            it("511 days = DL=255, DH bit0=1, no carry", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(86400 * 511);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(3), 255, "DL=255");
                assertEquals<u8>(MBC3RTC.Live(4) & 1, 1, "day bit 9 set");
                assertEquals<bool>(MBC3RTC.Carry, false, "carry still off");
            });

            it("512 days triggers carry, wraps day to 0", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(86400 * 512);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(3), 0, "DL wraps");
                assertEquals<u8>(MBC3RTC.Live(4) & 1, 0, "day bit 9 wraps");
                assertEquals<bool>(MBC3RTC.Carry, true, "carry set");
                assertEquals<u8>((MBC3RTC.Live(4) >> 7) & 1, 1, "DH bit7 set");
            });

            it("carry is sticky across further updates", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(86400 * 513);
                MBC3RTC.Update();
                MBC3RTC.SetRealTimeSec(86400 * 513 + 60);
                MBC3RTC.Update();
                assertEquals<bool>(MBC3RTC.Carry, true, "carry still set");
            });
        });

        describe("halt", () => {
            it("halt freezes the counter", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(30);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 30, "S=30 before halt");
                MBC3RTC.WriteReg(4, 0x40); // halt bit set
                MBC3RTC.SetRealTimeSec(30 + 60);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 30, "S frozen at 30");
                assertEquals<u8>(MBC3RTC.Live(1), 0, "M still 0");
            });

            it("clearing halt resumes from frozen time", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(100);
                MBC3RTC.Update();
                MBC3RTC.WriteReg(4, 0x40); // halt
                MBC3RTC.SetRealTimeSec(100 + 3600);
                MBC3RTC.Update();
                MBC3RTC.WriteReg(4, 0x00); // unhalt
                MBC3RTC.SetRealTimeSec(100 + 3600 + 10);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 110 % 60, "S = (100 + 10) mod 60");
                assertEquals<u8>(MBC3RTC.Live(1), 1, "M = 1");
            });
        });

        describe("WriteReg", () => {
            it("writing seconds resets count from new value", () => {
                resetAtEpoch(0);
                MBC3RTC.WriteReg(0, 45);
                assertEquals<u8>(MBC3RTC.Live(0), 45, "S=45 immediately");
                MBC3RTC.SetRealTimeSec(20);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 5, "S=5 (45+20)%60");
                assertEquals<u8>(MBC3RTC.Live(1), 1, "M=1 (45+20)/60");
            });

            it("writing hours bounded to 5 bits (0-31 storage)", () => {
                resetAtEpoch(0);
                MBC3RTC.WriteReg(2, 0xFF);
                assertEquals<u8>(MBC3RTC.Live(2), 0x1F, "H masked to 5 bits");
            });

            it("writing DH bit 6 sets halt flag", () => {
                resetAtEpoch(0);
                MBC3RTC.WriteReg(4, 0x40);
                assertEquals<bool>(MBC3RTC.Halted, true, "halt true");
            });

            it("writing DH bit 7 sets carry flag", () => {
                resetAtEpoch(0);
                MBC3RTC.WriteReg(4, 0x80);
                assertEquals<bool>(MBC3RTC.Carry, true, "carry true");
            });

            it("writing DH bit 7 = 0 clears carry (acknowledge overflow)", () => {
                resetAtEpoch(0);
                MBC3RTC.WriteReg(4, 0x80);
                MBC3RTC.WriteReg(4, 0x00);
                assertEquals<bool>(MBC3RTC.Carry, false, "carry cleared");
            });

            it("writing DL + DH bit 0 = full day 9-bit value", () => {
                resetAtEpoch(0);
                MBC3RTC.WriteReg(3, 100); // DL
                MBC3RTC.WriteReg(4, 0x01); // DH bit 0 = 1 → day 256+100=356
                MBC3RTC.SetRealTimeSec(86400); // +1 day
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(3), 101, "DL=101");
                assertEquals<u8>(MBC3RTC.Live(4) & 1, 1, "day bit 9 still 1");
            });
        });

        describe("latch", () => {
            it("Latch copies live → latched", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(125);
                MBC3RTC.Latch();
                assertEquals<u8>(MBC3RTC.Latched(0), 5, "latched S=5");
                assertEquals<u8>(MBC3RTC.Latched(1), 2, "latched M=2");
            });

            it("further time advance does not change latched until next latch", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(60);
                MBC3RTC.Latch();
                MBC3RTC.SetRealTimeSec(120);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Latched(0), 0, "latched S=0 (was 60s = 0s 1m)");
                assertEquals<u8>(MBC3RTC.Latched(1), 1, "latched M=1");
                assertEquals<u8>(MBC3RTC.Live(1), 2, "live M=2");
            });
        });

        describe("priming (fresh-boot fix)", () => {
            it("Init before any SetRealTimeSec leaves RTC unprimed", () => {
                MBC3RTC.UnprimeForTest();
                MBC3RTC.Init();
                assertEquals<bool>(MBC3RTC.IsPrimedForTest(), false, "still unprimed");
            });

            it("first SetRealTimeSec after fresh Init does NOT trigger spurious delta", () => {
                // Reproduce the production cold-boot path: module load → MBC3.Init runs with
                // epochSec=0 → host then sends Date.now()/1000 ≈ 1.7e9. Pre-fix: Update saw
                // delta ≈ 1.7e9 → carry set, accumSec wrapped mod 512 days.
                MBC3RTC.UnprimeForTest();
                MBC3RTC.Init();
                MBC3RTC.SetRealTimeSec(1_700_000_000);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 0, "S = 0 (no advance)");
                assertEquals<u8>(MBC3RTC.Live(1), 0, "M = 0");
                assertEquals<u8>(MBC3RTC.Live(2), 0, "H = 0");
                assertEquals<u8>(MBC3RTC.Live(3), 0, "DL = 0");
                assertEquals<u8>(MBC3RTC.Live(4), 0, "DH = 0");
                assertEquals<bool>(MBC3RTC.Carry, false, "carry NOT set");
            });

            it("Latch after fresh-boot prime returns zero (no phantom time)", () => {
                MBC3RTC.UnprimeForTest();
                MBC3RTC.Init();
                MBC3RTC.SetRealTimeSec(1_700_000_000);
                MBC3RTC.Latch();
                assertEquals<u8>(MBC3RTC.Latched(0), 0, "latched S = 0");
                assertEquals<u8>(MBC3RTC.Latched(4), 0, "latched DH = 0");
            });

            it("time advances normally AFTER priming + a wall-clock tick", () => {
                MBC3RTC.UnprimeForTest();
                MBC3RTC.Init();
                MBC3RTC.SetRealTimeSec(1_700_000_000); // prime
                MBC3RTC.SetRealTimeSec(1_700_000_065); // +65s
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 5, "S = 5");
                assertEquals<u8>(MBC3RTC.Live(1), 1, "M = 1");
            });

            it("primed flag is sticky across Init (preserves existing test semantics)", () => {
                MBC3RTC.UnprimeForTest();
                MBC3RTC.SetRealTimeSec(1000); // prime
                MBC3RTC.Init();               // re-init must NOT clear primed
                assertEquals<bool>(MBC3RTC.IsPrimedForTest(), true, "primed sticks across Init");
                MBC3RTC.SetRealTimeSec(1065);
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 5, "delta 65s applied");
            });

            it("reorder fix: SetRealTimeSec BEFORE Init also yields no spurious advance", () => {
                // Models the loop.ts preRun reorder (defense in depth).
                MBC3RTC.UnprimeForTest();
                MBC3RTC.SetRealTimeSec(1_700_000_000); // primes baseEpoch=1.7e9
                MBC3RTC.Init();                        // baseEpoch reseats to epochSec=1.7e9
                MBC3RTC.Update();
                assertEquals<u8>(MBC3RTC.Live(0), 0, "S = 0");
                assertEquals<bool>(MBC3RTC.Carry, false, "no carry");
            });
        });

        describe("Serialize/Deserialize 48-byte format", () => {
            it("round-trip preserves live + latched + halted + carry", () => {
                resetAtEpoch(1_700_000_000);
                MBC3RTC.SetRealTimeSec(1_700_000_125);
                MBC3RTC.Latch();
                MBC3RTC.WriteReg(4, 0xC0); // halt+carry

                const buf = new Uint8Array(48);
                MBC3RTC.SerializeTo(buf, 0);

                resetAtEpoch(1_700_000_125); // simulate reload at same instant
                MBC3RTC.DeserializeFrom(buf, 0, 48);

                assertEquals<u8>(MBC3RTC.Live(0), 5, "live S restored");
                assertEquals<u8>(MBC3RTC.Live(1), 2, "live M restored");
                assertEquals<u8>(MBC3RTC.Latched(0), 5, "latched S");
                assertEquals<u8>(MBC3RTC.Latched(1), 2, "latched M");
                assertEquals<bool>(MBC3RTC.Halted, true, "halted restored");
                assertEquals<bool>(MBC3RTC.Carry, true, "carry restored");
            });

            it("48-byte format: bytes 0,4,8,12,16 = live S,M,H,DL,DH low bytes", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(3 + 4 * 60 + 5 * 3600 + 6 * 86400);
                MBC3RTC.Latch();
                const buf = new Uint8Array(48);
                MBC3RTC.SerializeTo(buf, 0);
                assertEquals<u8>(buf[0], 3, "byte 0 = S");
                assertEquals<u8>(buf[4], 4, "byte 4 = M");
                assertEquals<u8>(buf[8], 5, "byte 8 = H");
                assertEquals<u8>(buf[12], 6, "byte 12 = DL");
                assertEquals<u8>(buf[16], 0, "byte 16 = DH (bit0=0)");
                assertEquals<u8>(buf[20], 3, "byte 20 = latched S");
            });

            it("unhalted reload advances time by elapsed seconds since saved", () => {
                resetAtEpoch(1_000_000);
                MBC3RTC.SetRealTimeSec(1_000_010);
                MBC3RTC.Update();
                MBC3RTC.Latch();

                const buf = new Uint8Array(48);
                MBC3RTC.SerializeTo(buf, 0);

                // Reload 60 seconds later
                resetAtEpoch(1_000_010 + 60);
                MBC3RTC.DeserializeFrom(buf, 0, 48);

                assertEquals<u8>(MBC3RTC.Live(0), 10, "S = (10 + 60) % 60 = 10");
                assertEquals<u8>(MBC3RTC.Live(1), 1, "M = 1");
            });

            it("halted reload does NOT advance time", () => {
                resetAtEpoch(0);
                MBC3RTC.SetRealTimeSec(30);
                MBC3RTC.Update();
                MBC3RTC.WriteReg(4, 0x40); // halt
                MBC3RTC.Latch();

                const buf = new Uint8Array(48);
                MBC3RTC.SerializeTo(buf, 0);

                resetAtEpoch(30 + 600);
                MBC3RTC.DeserializeFrom(buf, 0, 48);

                assertEquals<u8>(MBC3RTC.Live(0), 30, "S still 30 (halted)");
                assertEquals<u8>(MBC3RTC.Live(1), 0, "M still 0");
            });
        });

        describe("Serialize/Deserialize 44-byte legacy format", () => {
            it("loads 44-byte blob (32-bit timestamp)", () => {
                resetAtEpoch(1_000_000);
                MBC3RTC.SetRealTimeSec(1_000_010);
                MBC3RTC.Update();
                MBC3RTC.Latch();

                const buf = new Uint8Array(44);
                MBC3RTC.SerializeTo(buf, 0);

                resetAtEpoch(1_000_010 + 5);
                MBC3RTC.DeserializeFrom(buf, 0, 44);

                assertEquals<u8>(MBC3RTC.Live(0), 15, "S = 10 + 5");
            });
        });
    });

    return true;
}
